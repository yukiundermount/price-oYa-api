import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function normalizeConfidence(x) {
  const n = Number(x);
  if (!Number.isFinite(n) || n < 0) return 0;
  // 0〜1 ならそのまま
  if (n <= 1) return n;
  // 0〜100 なら 0〜1 へ
  if (n <= 100) return n / 100;
  // それ以上は上限1
  return 1;
}

function normalizeProfitMargin(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  // 0〜1 ならそのまま
  if (n >= 0 && n <= 1) return n;
  // 0〜100 なら 0〜1 へ
  if (n > 1 && n <= 100) return n / 100;
  // それ以外は丸め
  return Math.max(0, Math.min(1, n));
}

export default async function handler(req, res) {
  /* ===== CORS ===== */
  if (req.method === "OPTIONS") {
    return res.status(200).json({});
  }
  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "Method Not Allowed" });
  }

  try {
    const { category, brand, model, condition, year, accessories, strategy } = req.body || {};

    if (!category || !brand || !model) {
      return res.status(200).json({
        status: "error",
        message: "必須情報が不足しています（category/brand/model）",
      });
    }

    const prompt = `
あなたは中古市場のプロ鑑定士です。
以下の商品について、日本国内の一般的な中古相場を前提に、
「現実的で妥当な」買取目安と推奨販売価格を算出してください。

【商品情報】
カテゴリ: ${category}
ブランド: ${brand}
モデル: ${model}
状態: ${condition || ""}
年: ${year || ""}
付属品: ${accessories || ""}
販売戦略: ${strategy || ""}

【必須ルール】
- 相場とかけ離れた価格は禁止（極端に安い/高いの禁止）
- buyPrice, sellPrice は整数（円）
- sellPrice は buyPrice 以上
- profitMargin は 0〜1
- confidence は 0〜1
- JSONのみで返す

【JSON形式】
{
  "buyPrice": number,
  "sellPrice": number,
  "profitMargin": number,
  "confidence": number,
  "reason": string
}
`;

    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
    });

    const raw = completion.choices?.[0]?.message?.content || "";
    const ai = JSON.parse(raw);

    const buyPrice = Math.round(Number(ai.buyPrice));
    const sellPrice = Math.round(Number(ai.sellPrice));
    const profitMargin = normalizeProfitMargin(ai.profitMargin);
    const confidence = normalizeConfidence(ai.confidence);
    const reason = String(ai.reason || "");

    if (!Number.isFinite(buyPrice) || !Number.isFinite(sellPrice) || buyPrice <= 0 || sellPrice <= 0 || sellPrice < buyPrice) {
      throw new Error("Invalid price generated");
    }

    // API_BASE_URL がなくても動くように、自分自身のURLを自動生成
    const proto =
      (req.headers["x-forwarded-proto"] ? String(req.headers["x-forwarded-proto"]) : "")
        .split(",")[0]
        .trim() || "https";
    const host = req.headers["x-forwarded-host"] || req.headers["host"];
    const baseUrl = process.env.API_BASE_URL || `${proto}://${host}`;

    // Sheet保存（失敗しても STUDIO を落とさない）
    try {
      await fetch(`${baseUrl}/api/writeSheet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          brand,
          model,
          condition: condition || "",
          year: year || "",
          accessories: accessories || "",
          strategy: strategy || "",
          buyPrice,
          sellPrice,
          profitRate: Math.round(profitMargin * 100),
          reason,
        }),
      });
    } catch (e) {
      console.error("writeSheet failed:", e);
    }

    // STUDIO返却（0〜1で統一）
    return res.status(200).json({
      status: "ok",
      result: {
        price_buy: buyPrice,
        price_sell: sellPrice,
        profit_margin: profitMargin, // 0〜1
        confidence: confidence,       // 0〜1
        reasoning: reason,
        warnings: [],
      },
    });
  } catch (err) {
    console.error("price error:", err);
    return res.status(200).json({
      status: "error",
      message: "査定に失敗しました",
    });
  }
}

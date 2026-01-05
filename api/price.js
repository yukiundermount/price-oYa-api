export default async function handler(req, res) {

  // ===== CORS対応（最重要）=====
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  // =============================

  if (req.method !== "POST") {
    return res.status(405).json({
      status: "error",
      message: "Method Not Allowed"
    });
  }

  // ↓↓↓ ここから既存ロジック ↓↓↓



import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * カテゴリ正規化
 */
function normalizeCategory(input) {
  const v = (input || "").toString().trim().toLowerCase();

  if (v.includes("スニ") || v.includes("sneaker")) return "スニーカー";
  if (v.includes("デニ") || v.includes("jean")) return "デニム";
  if (v.includes("時計") || v.includes("watch")) return "腕時計";
  if (v.includes("バッグ") || v.includes("bag")) return "バッグ";
  if (v.includes("トレ") || v.includes("card") || v.includes("tcg")) return "トレカ";
  if (v.includes("衣類") || v.includes("服") || v.includes("apparel")) return "その他衣類";

  return "その他";
}

/**
 * 数値安全化
 */
function toInt(n, fallback = 0) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(0, Math.round(x));
}

/**
 * ガードレール（不適切価格を出さない）
 */
function applyGuardrail({ sell, buy }) {
  // buy <= sell を保証
  if (buy > sell) buy = Math.floor(sell * 0.8);

  // 異常値防止
  if (sell <= 0) sell = 0;
  if (buy < 0) buy = 0;

  const min = Math.min(buy, sell);

  const margin = sell > 0 ? (sell - buy) / sell : 0;

  return {
    price_sell: sell,
    price_buy: buy,
    price_min: min,
    profit_margin: Number(margin.toFixed(3))
  };
}

/**
 * API 本体
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      status: "error",
      message: "Method Not Allowed"
    });
  }

  try {
    const body = req.body || {};

    const category = normalizeCategory(body.category);
    const brand = body.brand || "";
    const model = body.model || "";
    const name = body.name || "";
    const condition = body.condition || "";
    const notes = body.notes || "";
    const ref = body.ref || "";

    /**
     * AIプロンプト
     * 👉 相場を「断定」させない
     * 👉 レンジ前提で出させる
     */
    const prompt = `
あなたは中古リユース市場の査定補助AIです。
以下の商品情報から、日本円ベースで「妥当な相場レンジ」を推定してください。

【重要ルール】
- 断定せず推定
- 異常に安い or 高い価格は出さない
- 中古業者目線
- buy < sell を必ず守る

【商品情報】
カテゴリ: ${category}
ブランド: ${brand}
モデル: ${model}
名称: ${name}
Ref/型番: ${ref}
状態: ${condition}
補足: ${notes}

【出力形式（JSONのみ）】
{
  "price_sell": number,
  "price_buy": number,
  "reasoning": "文字列",
  "confidence": 0.0〜1.0
}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: "Return JSON only." },
        { role: "user", content: prompt }
      ]
    });

    const rawText = completion.choices[0].message.content;

    let ai;
    try {
      ai = JSON.parse(rawText);
    } catch {
      throw new Error("AI response JSON parse failed");
    }

    const sell = toInt(ai.price_sell);
    const buy = toInt(ai.price_buy);

    const fixed = applyGuardrail({ sell, buy });

    return res.status(200).json({
      status: "ok",
      result: {
        category,
        currency: "JPY",
        price_sell: fixed.price_sell,
        price_buy: fixed.price_buy,
        price_min: fixed.price_min,
        profit_margin: fixed.profit_margin,
        confidence: Number(ai.confidence || 0.5),
        reasoning: ai.reasoning || "相場情報と一般的な市場傾向から推定",
        warnings: []
      }
    });
  } catch (err) {
    return res.status(500).json({
      status: "error",
      message: err.message || "Price calculation failed"
    });
  }
}

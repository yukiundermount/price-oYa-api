import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  /* ===== CORS ===== */
  if (req.method === "OPTIONS") {
    return res.status(200).json({});
  }

  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "Method Not Allowed" });
  }

  try {
    const {
      category,
      brand,
      model,
      condition,
      year,
      accessories,
      strategy,
    } = req.body;

    /* ===== 入力最低限チェック ===== */
    if (!category || !brand || !model) {
      return res.status(200).json({
        status: "error",
        message: "必須情報が不足しています",
      });
    }

    /* ===== AI プロンプト ===== */
    const prompt = `
あなたは中古市場のプロ鑑定士です。
以下の商品について、現在の一般的な日本国内中古市場相場を想定し、
「現実的で妥当な価格」だけを出してください。

【商品情報】
カテゴリ: ${category}
ブランド: ${brand}
モデル: ${model}
状態: ${condition}
年: ${year}
付属品: ${accessories}
販売戦略: ${strategy}

【ルール】
- 相場とかけ離れた価格は禁止
- confidence は 0〜1
- profit_margin は 0〜1
- 数字はすべて number
- JSONのみ返す

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

    const aiResult = JSON.parse(completion.choices[0].message.content);

    /* ===== 異常値ガード ===== */
    if (
      aiResult.buyPrice <= 0 ||
      aiResult.sellPrice <= 0 ||
      aiResult.sellPrice < aiResult.buyPrice
    ) {
      throw new Error("Invalid price generated");
    }

    /* ===== Sheet 保存（失敗してもログだけ出す） ===== */
    try {
      await fetch(`${process.env.API_BASE_URL}/api/writeSheet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          brand,
          model,
          condition,
          year,
          accessories,
          strategy,
          buyPrice: aiResult.buyPrice,
          sellPrice: aiResult.sellPrice,
          profitRate: Math.round(aiResult.profitMargin * 100),
          reason: aiResult.reason,
        }),
      });
    } catch (e) {
      console.error("writeSheet failed:", e);
    }

    /* ===== STUDIO 返却 ===== */
    return res.status(200).json({
      status: "ok",
      result: {
        price_buy: aiResult.buyPrice,
        price_sell: aiResult.sellPrice,
        profit_margin: aiResult.profitMargin, // 0〜1
        confidence: aiResult.confidence,       // 0〜1
        reasoning: aiResult.reason,
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

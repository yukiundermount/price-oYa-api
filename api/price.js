import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
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
      strategy
    } = req.body;

    /* ===== プロンプト ===== */
    const prompt = `
あなたは中古品のプロ鑑定士AIです。

【商品情報】
カテゴリ: ${category}
ブランド: ${brand}
モデル: ${model}
状態: ${condition}
年: ${year}
付属品: ${accessories}
販売戦略: ${strategy}

【出力ルール】
- buyPrice, sellPrice は整数（円）
- profitRate は整数（%）
- confidence は 0〜100
- JSONのみ返す

【出力形式】
{
  "buyPrice": number,
  "sellPrice": number,
  "profitRate": number,
  "confidence": number,
  "reason": string
}
`;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3
    });

    const aiResult = JSON.parse(completion.choices[0].message.content);

    // バリデーション
    if (!aiResult.buyPrice || !aiResult.sellPrice) {
      throw new Error("Invalid AI result");
    }

    /* ===== Sheet保存（await しないと race condition）===== */
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
        profitRate: aiResult.profitRate,
        reason: aiResult.reason
      })
    });

    /* ===== STUDIO 用レスポンス（最重要）===== */
    return res.status(200).json({
      status: "ok",
      result: {
        buyPrice: aiResult.buyPrice,
        sellPrice: aiResult.sellPrice,
        profitRate: aiResult.profitRate,
        confidence: aiResult.confidence,
        reason: aiResult.reason
      }
    });

  } catch (err) {
    console.error("price error:", err);
    return res.status(200).json({
      status: "error",
      message: "査定に失敗しました"
    });
  }
}

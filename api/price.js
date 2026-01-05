import OpenAI from "openai";

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
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

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    /* ===============================
       AI PROMPT（ここが心臓部）
    =============================== */

    const prompt = `
あなたは日本市場の中古・リセール専門のプロ査定AIです。

【商品情報】
- カテゴリ: ${category}
- ブランド: ${brand}
- モデル: ${model}
- 状態: ${condition}
- 年: ${year}
- 付属品: ${accessories}
- 販売戦略: ${strategy}

【ルール】
- 実在しない相場を作らない
- 極端に安すぎる / 高すぎる価格は禁止
- 市場感・流動性・戦略を考慮
- 数字はすべて整数（円）
- 不明要素が多い場合は保守的に

【出力形式（JSONのみ）】
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
      messages: [
        { role: "system", content: "You are a professional resale pricing AI." },
        { role: "user", content: prompt }
      ],
      temperature: 0.4,
    });

    const aiResult = JSON.parse(
      completion.choices[0].message.content
    );

    /* ===============================
       不適切価格 防御ロジック
    =============================== */

    if (
      aiResult.buyPrice <= 0 ||
      aiResult.sellPrice <= 0 ||
      aiResult.sellPrice <= aiResult.buyPrice
    ) {
      throw new Error("Invalid price generated");
    }

    // Sheet保存（非同期だが await する）
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
    reason: aiResult.reason,
  }),
});

    // Studio表示用レスポンス
    res.status(200).json({
      buyPrice: aiResult.buyPrice,
      sellPrice: aiResult.sellPrice,
      profitRate: aiResult.profitRate,
      confidence: aiResult.confidence,
      reason: aiResult.reason,
    });

  } catch (err) {
    console.error("price error:", err);
    res.status(500).json({ error: "Price calculation failed" });
  }
}

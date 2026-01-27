import OpenAI from "openai";
import { writeSheet } from "../lib/writeSheet.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      email,             // ← ★追加
      category,
      brand,
      model,
      condition,
      year,
      accessories,
      strategy,
      imageUrls = [],
    } = req.body;

    const prompt = `
あなたは中古品の価格査定AIです。

【商品情報】
カテゴリ: ${category}
ブランド: ${brand}
モデル: ${model}
状態: ${condition}
年式: ${year}
付属品: ${accessories}
販売戦略: ${strategy}
画像枚数: ${imageUrls.length}

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
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

    const aiResult = JSON.parse(completion.choices[0].message.content);

    // Sheets に保存
    await writeSheet({
      email,             // ← ★追加
      category,
      brand,
      model,
      condition,
      year,
      accessories,
      strategy,
      imageUrls: imageUrls.length > 0 ? "uploaded_image" : "",
      imageCount: imageUrls.length,
      buyPrice: aiResult.buyPrice,
      sellPrice: aiResult.sellPrice,
      profitRate: aiResult.profitRate,
      confidence: aiResult.confidence,
      reason: aiResult.reason,
    });

    // ★ STUDIO が期待する形で返す
    return res.status(200).json({
      result: {
        buyPrice: aiResult.buyPrice,
        sellPrice: aiResult.sellPrice,
        profitRate: aiResult.profitRate,
        confidence: aiResult.confidence,
        reason: aiResult.reason,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "price calculation failed",
      detail: err.message,
    });
  }
}


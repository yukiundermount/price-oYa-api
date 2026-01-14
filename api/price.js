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
      category,
      brand,
      model,
      condition,
      year,
      accessories,
      strategy,
      imageUrls = [],
    } = req.body;

    const imageCount = Array.isArray(imageUrls) ? imageUrls.length : 0;

    const prompt = `
あなたは中古商品の価格査定AIです。

【商品情報】
カテゴリ: ${category}
ブランド: ${brand}
モデル: ${model}
状態: ${condition}
年式: ${year}
付属品: ${accessories}
販売戦略: ${strategy}
画像枚数: ${imageCount}

【出力条件】
必ず以下のJSON形式のみで出力してください。

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
      temperature: 0.4,
    });

    const text = completion.choices[0].message.content;
    const result = JSON.parse(text);

    const buyPrice = Number(result.buyPrice);
    const sellPrice = Number(result.sellPrice);
    const profitRate = Number(result.profitRate);
    const confidence = Number(result.confidence);
    const reason = result.reason ?? "";

    if (
      Number.isNaN(buyPrice) ||
      Number.isNaN(sellPrice) ||
      Number.isNaN(profitRate)
    ) {
      throw new Error("Invalid AI price output");
    }

    // Sheets書き込み
    await writeSheet({
      category,
      brand,
      model,
      condition,
      year,
      accessories,
      strategy,
      imageUrls: imageCount > 0 ? "uploaded_image" : "",
      imageCount,
      buyPrice,
      sellPrice,
      profitRate,
      confidence,
      reason,
    });

    // ★ Studioに必ず返す
    return res.status(200).json({
      buyPrice,
      sellPrice,
      profitRate,
      confidence,
      reason,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "AI査定に失敗しました",
      detail: err.message,
    });
  }
}


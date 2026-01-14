import OpenAI from "openai";
import { writeSheet } from "../lib/writeSheet";

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

【販売戦略ルール】
quick_sell: 早く売れる価格
balance: 相場バランス
high_price: 高値狙い（時間がかかっても良い）

【出力形式（JSON厳守）】
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

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      throw new Error("AI response is not valid JSON");
    }

    const buyPrice = Number(result.buyPrice) || 0;
    const sellPrice = Number(result.sellPrice) || 0;
    const profitRate = Number(result.profitRate) || 0;
    const confidence = Number(result.confidence) || 0;
    const reason = String(result.reason || "");

    await writeSheet({
      category,
      brand,
      model,
      condition,
      year,
      accessories,
      strategy,
      imageUrls: Array.isArray(imageUrls) ? imageUrls.join(",") : "",
      imageCount: Array.isArray(imageUrls) ? imageUrls.length : 0,
      buyPrice,
      sellPrice,
      profitRate,
      confidence,
      reason,
    });

    return res.status(200).json({
      result: {
        buyPrice,
        sellPrice,
        profitRate,
        confidence,
        reason,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "AI pricing failed",
      detail: err.message,
    });
  }
}


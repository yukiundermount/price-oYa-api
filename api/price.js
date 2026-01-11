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
      imageCount = 0,
    } = req.body;

    const prompt = `
あなたは中古品のプロ鑑定士です。
以下の情報から「必ずJSONのみ」で回答してください。

出力形式:
{
  "buyPrice": number,
  "sellPrice": number,
  "profitRate": number,
  "confidence": number,
  "reason": string
}

条件:
- 数値は整数
- 文章は禁止（JSONのみ）

商品:
カテゴリ: ${category}
ブランド: ${brand}
モデル: ${model}
状態: ${condition}
年式: ${year}
付属品: ${accessories}
販売戦略: ${strategy}
画像枚数: ${imageCount}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
    });

    let result;
    try {
      result = JSON.parse(completion.choices[0].message.content);
    } catch {
      throw new Error("AI response is not valid JSON");
    }

    const payload = {
      category,
      brand,
      model,
      condition,
      year,
      accessories,
      strategy,
      imageCount,
      ...result,
    };

    await writeSheet(payload);

    return res.status(200).json({ result });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "AI pricing failed",
      detail: err.message,
    });
  }
}


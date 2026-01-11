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
      imageCount = 0,
    } = req.body;

    const prompt = `
あなたは日本の中古・高級品リセール市場に精通したプロの鑑定士です。

以下の商品情報をもとに、
「現実的に売れる価格」を前提として、
買取目安価格・推奨販売価格・利益率・判断理由を算出してください。

【前提条件】
- 市場相場を考慮
- 状態・年式・付属品・販売戦略を必ず反映
- 数値は日本円
- 利益率 = (販売価格 - 買取価格) ÷ 買取価格
- 利益率は小数
- 判断理由は日本語

【商品情報】
カテゴリ: ${category}
ブランド: ${brand}
モデル: ${model}
状態: ${condition}
年式: ${year}
付属品: ${accessories}
販売戦略: ${strategy}
画像枚数: ${imageCount}

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
      model: process.env.OPENAI_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

    const aiResult = JSON.parse(completion.choices[0].message.content);

    await writeSheet({
      category,
      brand,
      model,
      condition,
      year,
      accessories,
      strategy,
      imageCount,
      ...aiResult,
    });

    return res.status(200).json(aiResult);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "AI price calculation failed" });
  }
}


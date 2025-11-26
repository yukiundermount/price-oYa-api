import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const { image1, image2, image3, description, category, target_profit } =
      req.body;

    const prompt = `
あなたは商品価格のプロです。
以下の情報から BUY PRICE（仕入れ値）と SELL PRICE（販売価格）を算出してください。

【商品情報】
画像URL1: ${image1}
画像URL2: ${image2}
画像URL3: ${image3}
説明: ${description}
カテゴリー: ${category}
目標利益率: ${target_profit}%
`;

    const completion = await client.responses.create({
      model: "gpt-4o-mini",
      input: prompt,
    });

    const text = completion.output[0].content[0].text;

    return res.status(200).json({ result: text });
  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({
      error: "Server error",
      details: error.message,
    });
  }
}

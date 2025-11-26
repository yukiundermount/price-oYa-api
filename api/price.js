import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { image1, image2, image3, description, category, target_profit } =
      req.body;

    if (!image1 && !description) {
      return res.status(400).json({
        error: "At least one of image1 or description is required.",
      });
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `
あなたはプロのEC担当者です。
以下のデータから商品価格を予測し、JSONだけで回答してください。

【画像URL】
image1: ${image1}
image2: ${image2 || ""}
image3: ${image3 || ""}

【商品説明】
${description}

【カテゴリ】
${category}

【目標利益率】
${target_profit}

出力フォーマット（JSONのみ）:
{
  "buy_price": 数値,
  "sell_price": 数値,
  "ai_result": "説明テキスト"
}
`;

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: prompt,
      max_output_tokens: 500,
    });

    const text = response.output_text;

    return res.status(200).json({ result: text });
  } catch (error) {
    console.error("API ERROR:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}

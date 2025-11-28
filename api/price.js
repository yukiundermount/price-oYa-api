import OpenAI from "openai";

export default async function handler(req, res) {
  // POST 以外は拒否
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const {
      user_email,
      company,
      description,
      image1,
      image2,
      image3,
      category,
      target_profit,
    } = req.body;

    const prompt = `
あなたはプロの鑑定士です。
以下の商品情報から BUY PRICE（仕入れ値）と SELL PRICE（販売価格）を計算してください。

【商品情報】
説明：${description}
画像1：${image1}
画像2：${image2}
画像3：${image3}
カテゴリ：${category}
希望利益率：${target_profit}%

出力は必ず以下のJSON形式で返してください：
{
  "buy_price": 数値,
  "sell_price": 数値,
  "comment": "短いコメント"
}
`;

    const completion = await client.responses.create({
      model: "gpt-4.1-mini",
      input: prompt,
      max_output_tokens: 400,
    });

    const aiText = completion.output_text;

    return res.status(200).json({
      result: aiText,
    });
  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({
      error: error.message,
    });
  }
}

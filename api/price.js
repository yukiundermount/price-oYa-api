import OpenAI from "openai";

export default async function handler(req, res) {
  // GET 専用に変更（Glide の Open Link で使える）
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Only GET allowed" });
  }

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // URL パラメータを取得
    const user_email = req.query.user_email || "";
    const company = req.query.company || "";

    const prompt = `
あなたは価格算出AIです。
以下のユーザー情報を元に BUY PRICE（仕入れ）と SELL PRICE（販売価格）を計算してください。

【ユーザー情報】
メール：${user_email}
会社名：${company}

出力は以下の形式：
BUY_PRICE: xxxx
SELL_PRICE: xxxx
    `;

    const completion = await client.responses.create({
      model: "gpt-4o-mini",
      input: prompt,
    });

    const text = completion.output_text || "No result";

    return res.status(200).json({ result: text });
  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({ error: error.message });
  }
}

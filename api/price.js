import OpenAI from "openai";

export default async function handler(req, res) {
  // POST 以外は拒否
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // ① 環境変数チェック
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY is not set"
      });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // ② GAS から受け取る prompt
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({
        error: "prompt is required"
      });
    }

    // ③ OpenAI 呼び出し
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are a professional second-hand goods appraiser.
Return ONLY valid JSON.
Do NOT use code blocks.
Do NOT add explanations outside JSON.
Use ONLY the following keys in English:

{
  "buy_price": 0,
  "sell_price": 0,
  "profit_rate": 0,
  "reason": ""
}
`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3
    });

    const rawText = completion.choices[0].message.content;

    // ④ JSON パース（失敗したらエラー）
    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (e) {
      return res.status(500).json({
        error: "AI response is not valid JSON",
        raw: rawText
      });
    }

    // ⑤ 必須キー確認
    const requiredKeys = [
      "buy_price",
      "sell_price",
      "profit_rate",
      "reason"
    ];

    for (const key of requiredKeys) {
      if (!(key in parsed)) {
        return res.status(500).json({
          error: `Missing key in AI response: ${key}`,
          parsed
        });
      }
    }

    // ⑥ 正常レスポンス
    return res.status(200).json({
      buy_price: Number(parsed.buy_price),
      sell_price: Number(parsed.sell_price),
      profit_rate: Number(parsed.profit_rate),
      reason: parsed.reason
    });

  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
}

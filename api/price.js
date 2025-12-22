import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY is not set"
      });
    }

    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "prompt is required" });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are a professional second-hand goods appraiser.
Return ONLY valid JSON.
Do NOT use code blocks.
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

    let ai;
    try {
      ai = JSON.parse(rawText);
    } catch {
      return res.status(500).json({
        error: "AI response is not valid JSON",
        raw: rawText
      });
    }

    // ==========
    // 🔒 数値ガード
    // ==========

    let buy = Number(ai.buy_price);
    let sell = Number(ai.sell_price);

    if (isNaN(buy) || buy < 0) {
      buy = 0;
    }

    if (isNaN(sell) || sell < buy) {
      sell = buy;
    }

    // 利益率は必ずサーバーで再計算
    const profitRate =
      buy === 0 ? 0 : Math.round(((sell - buy) / buy) * 100);

    // reason に補正ログを残す
    let reason = ai.reason || "";
    if (ai.buy_price < 0) {
      reason += " (buy_price was corrected to 0)";
    }
    if (ai.sell_price < ai.buy_price) {
      reason += " (sell_price was corrected)";
    }

    return res.status(200).json({
      buy_price: buy,
      sell_price: sell,
      profit_rate: profitRate,
      reason
    });

  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
}

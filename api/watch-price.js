import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // ==========
    // 0. 入力取得
    // ==========
    const {
      brand,
      model,
      condition,
      year,
      accessories,
      strategy,
      images = []
    } = req.body;

    if (!brand || !model || !condition) {
      return res.status(400).json({
        error: "brand, model, condition are required"
      });
    }

    // ==========
    // 1. OpenAI 初期化
    // ==========
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY is not set"
      });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // ==========
    // 2. 腕時計専用プロンプト
    // ==========
    const systemPrompt = `
You are a professional appraiser specializing in luxury watches.
You evaluate watches for the Japanese second-hand market.
Focus on realistic resale prices for physical stores.
Do not overestimate prices.
Return ONLY valid JSON.
Do NOT use code blocks.
`;

    const userPrompt = `
Please appraise the following wristwatch.

[Watch Information]
Brand: ${brand}
Model: ${model}
Condition: ${condition}
Production Year: ${year || "unknown"}
Accessories: ${accessories || "unknown"}
Selling Strategy: ${strategy || "balanced"}

[Requirements]
- Consider current Japanese resale market
- Prioritize liquidity and realistic turnover price
- Output must be JSON only
- Use the following format exactly:

{
  "buy_price": number,
  "sell_price": number,
  "profit_rate": number,
  "reason": string
}
`;

    // ==========
    // 3. OpenAI 呼び出し（Vision対応）
    // ==========
    const messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          ...images.map(url => ({
            type: "image_url",
            image_url: { url }
          }))
        ]
      }
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.3
    });

    const raw = completion.choices[0].message.content;

    let ai;
    try {
      ai = JSON.parse(raw);
    } catch {
      return res.status(500).json({
        error: "AI response is not valid JSON",
        raw
      });
    }

    // ==========
    // 4. 数値ガード（業務必須）
    // ==========
    let buy = Number(ai.buy_price);
    let sell = Number(ai.sell_price);

    if (isNaN(buy) || buy < 0) buy = 0;
    if (isNaN(sell) || sell < buy) sell = buy;

    const profitRate =
      buy === 0 ? 0 : Math.round(((sell - buy) / buy) * 100);

    return res.status(200).json({
      buy_price: buy,
      sell_price: sell,
      profit_rate: profitRate,
      reason: ai.reason || ""
    });

  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
}

import OpenAI from "openai";

export default async function handler(req, res) {
  /* ===== CORS（STUDIO iframe 対応） ===== */
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
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
    } = req.body;

    /* ===== OpenAI ===== */
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `
あなたは日本の中古品プロ鑑定士です。
以下の商品情報から価格を算出してください。

【条件】
- 日本円
- 数値は整数
- JSONのみ返す
- buyPrice, sellPrice, profitRate, reason を必ず含める

【商品情報】
カテゴリ: ${category}
ブランド: ${brand}
モデル: ${model}
状態: ${condition}
年: ${year}
付属品: ${accessories}
販売戦略: ${strategy}

【出力JSON形式】
{
  "buyPrice": number,
  "sellPrice": number,
  "profitRate": number,
  "reason": string
}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Return ONLY valid JSON." },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
    });

    const result = JSON.parse(completion.choices[0].message.content);

    /* ===== Sheet に書き込み（内部呼び出し） ===== */
    await fetch("https://price-o-ya-api.vercel.app/api/writeSheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        category,
        brand,
        model,
        condition,
        year,
        accessories,
        strategy,
        buyPrice: result.buyPrice,
        sellPrice: result.sellPrice,
        profitRate: result.profitRate,
        reason: result.reason,
      }),
    });

    /* ===== フロントに返す ===== */
    return res.status(200).json(result);

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "AI calculation failed",
    });
  }
}



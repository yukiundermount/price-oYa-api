import OpenAI from "openai";

export default async function handler(req, res) {
  // ===== CORS =====
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

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    /**
     * 🔴 重要：ここが肝
     * ・不明でも「仮定して」必ず価格を出す
     * ・0は禁止
     * ・JSON以外禁止
     */
    const prompt = `
You are a professional second-hand goods appraiser in Japan.

Even if some product information is missing or vague:
- You MUST estimate reasonable prices based on similar items.
- NEVER return 0.
- NEVER say "cannot determine".
- ALWAYS return numeric values.

Return ONLY valid JSON with the following keys:

buyPrice: number (JPY, integer, >= 1000)
sellPrice: number (JPY, integer, > buyPrice)
profitRate: number (integer percentage)
reason: string (short Japanese explanation)

Product info:
category: ${category}
brand: ${brand}
model: ${model}
condition: ${condition}
year: ${year}
accessories: ${accessories}
strategy: ${strategy}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: prompt }],
      temperature: 0.7,
    });

    const text = completion.choices[0].message.content;
    const result = JSON.parse(text);

    // ===== 念のための最終ガード =====
    const buyPrice = Math.max(1000, Number(result.buyPrice));
    const sellPrice = Math.max(buyPrice + 1000, Number(result.sellPrice));
    const profitRate = Number(result.profitRate) || Math.round(((sellPrice - buyPrice) / sellPrice) * 100);
    const reason = result.reason || "市場相場と類似商品の平均から算出しました。";

    // ===== Sheets に書き込み =====
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
        buyPrice,
        sellPrice,
        profitRate,
        reason,
      }),
    });

    // ===== STUDIO へ返却 =====
    return res.status(200).json({
      buyPrice,
      sellPrice,
      profitRate,
      reason,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "AI査定に失敗しました",
    });
  }
}


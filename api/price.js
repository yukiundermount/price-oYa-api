import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
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

    /* ===============================
       値付けoYa 専用プロンプト
    =============================== */
    const prompt = `
あなたは中古品ビジネスのプロ査定士AIです。

【カテゴリ】${category}
【ブランド】${brand}
【モデル】${model}
【状態】${condition}
【年式】${year}
【付属品】${accessories}
【販売戦略】${strategy}

以下の条件を必ず守ってください。

- 現実の中古市場相場から大きく外れない
- 新品定価や異常値を出さない
- 売却可能性を重視する
- 利益率は 10〜40% の範囲に収める
- 数値はすべて整数（円）
- JSONのみで回答する

出力形式：
{
  "buyPrice": number,
  "sellPrice": number,
  "profitRate": number,
  "confidence": number,
  "reason": string
}
`;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a professional resale pricing AI." },
        { role: "user", content: prompt }
      ],
      temperature: 0.4,
    });

    const aiResult = JSON.parse(
      completion.choices[0].message.content
    );

    if (
      !aiResult.buyPrice ||
      !aiResult.sellPrice ||
      aiResult.sellPrice <= aiResult.buyPrice
    ) {
      throw new Error("Invalid price generated");
    }

    // 🔽 Sheet保存（ここ重要）
    await fetch(`${process.env.API_BASE_URL}/api/writeSheet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category,
        brand,
        model,
        condition,
        year,
        accessories,
        strategy,
        buyPrice: aiResult.buyPrice,
        sellPrice: aiResult.sellPrice,
        profitRate: aiResult.profitRate,
        reason: aiResult.reason,
      }),
    });

    // Studio返却
    return res.status(200).json({
      buyPrice: aiResult.buyPrice,
      sellPrice: aiResult.sellPrice,
      profitRate: aiResult.profitRate,
      confidence: aiResult.confidence,
      reason: aiResult.reason,
    });

  } catch (err) {
    console.error("price error:", err);
    return res.status(200).json({
      error: true,
      message: "査定に失敗しました",
    });
  }
}

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  // CORS対応（STUDIO iframe 対策）
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      brand,
      model,
      condition,
      year,
      accessories,
      strategy,
    } = req.body;

    // プロンプト（腕時計AI査定）
    const prompt = `
あなたは中古ブランド腕時計のプロ査定AIです。

以下の商品情報をもとに、
・想定仕入価格（buyPrice）
・推奨販売価格（sellPrice）
・利益率（profitRate, %）
・判断理由（reason,日本語で詳しく）

を必ず「JSON形式のみ」で出力してください。

【商品情報】
カテゴリ: 腕時計
ブランド: ${brand}
モデル: ${model}
状態: ${condition}
製造年: ${year}
付属品: ${accessories}
販売戦略: ${strategy}

【出力形式】
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
        { role: "system", content: "あなたは中古腕時計の価格査定AIです。" },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
    });

    const text = completion.choices[0].message.content;

    // JSONとして安全にパース
    const result = JSON.parse(text);

    return res.status(200).json({
      buyPrice: result.buyPrice,
      sellPrice: result.sellPrice,
      profitRate: result.profitRate,
      reason: result.reason,
    });

  } catch (error) {
    console.error("AI査定エラー:", error);
    return res.status(500).json({
      error: "AI査定に失敗しました",
      detail: error.message,
    });
  }
}



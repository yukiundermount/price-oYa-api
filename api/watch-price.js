import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  /* =========================
     CORS（Glide / STUDIO 必須）
  ========================= */
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
      category,   // STUDIO: 腕時計 / バッグ / スニーカー
      brand,
      model,
      condition,
      year,
      accessories,
      strategy,   // 早く売りたい / バランス / 高値で売りたい
    } = req.body;

    /* =========================
       カテゴリ別プロンプト
    ========================= */
    const systemPromptMap = {
      "腕時計": "あなたは高級腕時計専門の中古相場査定AIです。",
      "バッグ": "あなたは高級ブランドバッグ専門の中古相場査定AIです。",
      "スニーカー": "あなたは人気・限定スニーカー専門の中古相場査定AIです。",
    };

    const systemPrompt =
      systemPromptMap[category] ||
      "あなたは中古商品の市場価格を推定するAIです。";

    const userPrompt = `
以下の商品について「現在の標準的な市場販売相場（円）」を推定してください。

カテゴリ：${category}
ブランド：${brand}
モデル：${model}
状態：${condition}
年式：${year}
付属品：${accessories}

必ず次の JSON 形式で返してください。
{
  "marketPrice": number,
  "reason": string
}
`.trim();

    /* =========================
       OpenAI 呼び出し
    ========================= */
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const text = completion.choices[0].message.content;
    const aiResult = JSON.parse(text);

    const baseMarketPrice = Number(aiResult.marketPrice);
    if (!baseMarketPrice || isNaN(baseMarketPrice)) {
      return res.status(500).json({ error: "Invalid market price" });
    }

    /* =========================
       戦略別 売値調整
    ========================= */
    const sellMultiplier =
      strategy === "早く売りたい" ? 0.95 :
      strategy === "高値で売りたい" ? 1.10 :
      1.0;

    const profitRate =
      strategy === "早く売りたい" ? 10 :
      strategy === "高値で売りたい" ? 20 :
      15;

    const sellPrice = Math.round(baseMarketPrice * sellMultiplier);
    const buyPrice = Math.round(
      sellPrice * (1 - profitRate / 100)
    );

    /* =========================
       レスポンス
    ========================= */
    return res.status(200).json({
      buyPrice,
      sellPrice,
      profitRate,
      reason: aiResult.reason,
    });

  } catch (err) {
    console.error("watch-price error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}



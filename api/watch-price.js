import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  /* =========================
     CORS（Glide新UI必須）
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
      category,
      brand,
      model,
      condition,
      year,
      accessories,
      strategy,
    } = req.body;

    /* =========================
       カテゴリ別システムプロンプト
    ========================= */
    const systemPromptMap = {
      "腕時計": "あなたは高級腕時計専門の中古相場査定AIです。",
      "バッグ": "あなたは高級ブランドバッグ専門の中古相場査定AIです。",
      "トレーディングカード": "あなたはトレーディングカード専門の市場価格査定AIです。",
      "スニーカー": "あなたは限定・人気スニーカー専門の中古相場査定AIです。",
      "デニム": "あなたはヴィンテージ・ブランドデニム専門の査定AIです。",
      "その他衣類": "あなたはブランド衣類全般の中古相場査定AIです。",
      "その他": "あなたは中古商品の市場価格を推定するAIです。",
    };

    const systemPrompt =
      systemPromptMap[category] ||
      "あなたは中古商品の市場価格を推定するAIです。";

    const userPrompt = `
以下の商品について「現在の市場想定販売価格（円）」を1つだけ数値で推定してください。

カテゴリ：${category}
ブランド：${brand}
モデル：${model}
状態：${condition}
年式：${year}
付属品：${accessories}
販売戦略：${strategy}

必ず次の JSON 形式でのみ返してください。
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

    let aiResult;
    try {
      aiResult = JSON.parse(text);
    } catch {
      return res.status(500).json({
        error: "AI response parse error",
        raw: text,
      });
    }

    /* =========================
       価格計算（NaN防止）
    ========================= */
    const marketPrice = Number(aiResult.marketPrice);

    if (!marketPrice || isNaN(marketPrice)) {
      return res.status(500).json({
        error: "Invalid market price from AI",
        raw: aiResult,
      });
    }

    const profitRate =
      strategy === "早く売りたい" ? 10 :
      strategy === "バランスよく売りたい" ? 15 :
      20;

    const sellPrice = Math.round(marketPrice);
    const buyPrice = Math.round(
      sellPrice * (1 - profitRate / 100)
    );

    /* =========================
       Glide に返却
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



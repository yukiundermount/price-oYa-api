import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  /**
   * =========================
   * CORS（Glide 新UI 必須）
   * =========================
   */
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  /**
   * =========================
   * OPTIONS（プリフライト）
   * =========================
   */
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  /**
   * =========================
   * POST 以外は拒否
   * =========================
   */
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

    /**
     * =========================
     * カテゴリ別プロンプト
     * =========================
     */
    let systemPrompt = "";
    let userPrompt = "";

    if (category === "watch") {
      systemPrompt =
        "あなたは高級腕時計専門の中古査定AIです。市場相場と需要を重視してください。";

      userPrompt = `
以下の腕時計を査定してください。

ブランド：${brand}
モデル：${model}
状態：${condition}
製造・購入年：${year}
付属品：${accessories}
販売戦略：${strategy}

次の JSON 形式でのみ出力してください。
{
  "price": number,
  "profitRate": number,
  "reason": string
}
`.trim();
    } else {
      return res.status(400).json({
        error: "Unsupported category",
      });
    }

    /**
     * =========================
     * OpenAI 呼び出し
     * =========================
     */
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const text = completion.choices[0].message.content;

    /**
     * =========================
     * JSON パース
     * =========================
     */
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      return res.status(500).json({
        error: "AI response parse error",
        raw: text,
      });
    }

    /**
     * =========================
     * Glide に返却
     * =========================
     */
    return res.status(200).json({
      price: result.price,
      profitRate: result.profitRate,
      reason: result.reason,
    });
  } catch (err) {
    console.error("watch-price error:", err);

    return res.status(500).json({
      error: "Internal server error",
    });
  }
}




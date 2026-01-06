import OpenAI from "openai";
import { writeSheet } from "./writeSheet";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * ```json や ``` を含むAI出力を安全にJSON化する
 */
function safeJsonParse(text) {
  try {
    const cleaned = text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("❌ JSON parse failed. Raw output:", text);
    return null;
  }
}

/**
 * 販売戦略を価格係数に変換
 */
function strategyMultiplier(strategy) {
  switch (strategy) {
    case "quick_sell":
      return 0.95; // 早く売る → 安く
    case "high_price":
      return 1.08; // 高く売る
    case "balance":
    default:
      return 1.0;
  }
}

export default async function handler(req, res) {
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
      imageUrls = [],
    } = req.body;

    const imageCount = Array.isArray(imageUrls) ? imageUrls.length : 0;

    /**
     * Vision 用 message（画像がある場合のみ）
     */
    const visionContent =
      imageCount > 0
        ? [
            {
              type: "text",
              text: `
あなたは日本の高級リユース市場の真贋・価格鑑定AIです。

【絶対ルール】
- 出力は JSON のみ
- ``` や説明文は禁止
- 数値は number 型

【出力形式】
{
  "baseSellPrice": number,
  "confidence": number,
  "authenticityRisk": "low" | "medium" | "high",
  "reason": string
}
`,
            },
            ...imageUrls.map((url) => ({
              type: "image_url",
              image_url: { url },
            })),
          ]
        : [
            {
              type: "text",
              text: `
あなたは日本の高級リユース市場の価格鑑定AIです。

【絶対ルール】
- 出力は JSON のみ
- ``` や説明文は禁止

【出力形式】
{
  "baseSellPrice": number,
  "confidence": number,
  "authenticityRisk": "unknown",
  "reason": string
}
`,
            },
          ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: "You are a professional resale appraisal AI.",
        },
        {
          role: "user",
          content: `
【商品情報】
カテゴリ: ${category}
ブランド: ${brand}
モデル: ${model}
状態: ${condition}
年式: ${year}
付属品: ${accessories}
販売戦略: ${strategy}
`,
        },
        {
          role: "user",
          content: visionContent,
        },
      ],
    });

    const raw = completion.choices[0].message.content;
    const ai = safeJsonParse(raw);

    if (!ai || !ai.baseSellPrice) {
      throw new Error("Invalid AI response");
    }

    /** 戦略反映 */
    const multiplier = strategyMultiplier(strategy);
    const sellPrice = Math.round(ai.baseSellPrice * multiplier);
    const buyPrice = Math.round(sellPrice * 0.8);
    const profitRate = Number(
      (((sellPrice - buyPrice) / sellPrice) * 100).toFixed(1)
    );

    /** Sheets 書き込み（失敗しても API は成功させる） */
    try {
      await writeSheet({
        timestamp: new Date().toISOString(),
        category,
        brand,
        model,
        condition,
        year,
        accessories,
        strategy,
        imageUrls: imageUrls.join(","),
        imageCount,
        buyPrice,
        sellPrice,
        profitRate,
        reason: ai.reason,
      });
    } catch (sheetErr) {
      console.error("⚠️ sheet write failed:", sheetErr);
    }

    /** Studio 返却 */
    return res.status(200).json({
      status: "ok",
      result: {
        buyPrice,
        sellPrice,
        profitRate,
        confidence: ai.confidence ?? 0.8,
        authenticityRisk: ai.authenticityRisk ?? "unknown",
        imageCount,
        reasoning: ai.reason,
      },
    });
  } catch (err) {
    console.error("❌ price error:", err);
    return res.status(500).json({
      status: "error",
      message: "査定に失敗しました",
    });
  }
}


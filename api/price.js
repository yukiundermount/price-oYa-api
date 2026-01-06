import OpenAI from "openai";
import { writeSheet } from "./writeSheet.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// CORS
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "Method not allowed" });
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
      images, // ← Studio から渡る想定（File → URL 文字列配列）
    } = req.body || {};

    // ✅ 画像ログ用（AIには渡さない）
    const imageUrls = Array.isArray(images) ? images : [];
    const imageCount = imageUrls.length;

    const systemPrompt = `
あなたは日本の中古市場に精通したプロ鑑定士AIです。
出力は JSON のみで返してください。
`;

    const userPrompt = `
【商品情報】
カテゴリ: ${category}
ブランド: ${brand}
モデル: ${model}
状態: ${condition}
年式: ${year}
付属品: ${accessories}
販売戦略: ${strategy}

【出力形式】
{
  "buyPrice": number,
  "sellPrice": number,
  "profitRate": number,
  "confidence": number,
  "reason": string
}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const content = completion.choices?.[0]?.message?.content || "{}";
    const aiResult = JSON.parse(content);

    // ✅ Sheets へ保存（ここが正解）
    await writeSheet({
      category,
      brand,
      model,
      condition,
      year,
      accessories,
      strategy,
      imageUrls,
      imageCount,
      buyPrice: aiResult.buyPrice,
      sellPrice: aiResult.sellPrice,
      profitRate: aiResult.profitRate,
      reason: aiResult.reason,
    });

    return res.status(200).json({
      status: "ok",
      result: {
        buyPrice: aiResult.buyPrice,
        sellPrice: aiResult.sellPrice,
        profitRate: aiResult.profitRate,
        confidence: aiResult.confidence,
        reason: aiResult.reason,
      },
    });
  } catch (err) {
    console.error("price error:", err);
    return res.status(500).json({
      status: "error",
      message: "査定に失敗しました",
    });
  }
}


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
      imageUrls = [], // ← 重要：必ず配列
    } = req.body || {};

    const safeImageUrls = Array.isArray(imageUrls) ? imageUrls : [];
    const imageCount = safeImageUrls.length;

    const systemPrompt = `
あなたは日本の中古・新品市場に精通したプロ鑑定士AIです。
出力は JSON のみ。
confidence / profitRate は 0〜1。
`;

    const userPrompt = `
【商品情報】
カテゴリ: ${category}
ブランド: ${brand}
モデル: ${model}
状態: ${condition}
年: ${year}
付属品: ${accessories}
販売戦略: ${strategy}

【画像情報】
枚数: ${imageCount}
URL: ${safeImageUrls.join(", ")}

【出力形式(JSONのみ)】
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

    // Sheet保存（失敗してもレスポンスは返す）
    try {
      await writeSheet({
        category,
        brand,
        model,
        condition,
        year,
        accessories,
        strategy,
        imageUrls: safeImageUrls.join(","),
        imageCount,
        buyPrice: aiResult.buyPrice,
        sellPrice: aiResult.sellPrice,
        profitRate: aiResult.profitRate,
        reason: aiResult.reason,
      });
    } catch (sheetErr) {
      console.error("sheet write failed:", sheetErr);
    }

    return res.status(200).json({
      status: "ok",
      result: {
        buyPrice: aiResult.buyPrice,
        sellPrice: aiResult.sellPrice,
        profitRate: aiResult.profitRate,
        confidence: aiResult.confidence,
        reason: aiResult.reason,
        imageCount,
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

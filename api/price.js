import OpenAI from "openai";
import { writeSheet } from "./writeSheet.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// -------------------------
// CORS ヘルパー
// -------------------------
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

export default async function handler(req, res) {
  setCors(res);

  // ✅ Preflight（これが無いと 405）
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // POST 以外は拒否
  if (req.method !== "POST") {
    return res.status(405).json({
      status: "error",
      message: "Method not allowed",
    });
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
    } = req.body || {};

    const systemPrompt = `
あなたは日本の中古・新品市場に精通したプロ鑑定士AIです。
出力は JSON のみで返してください（コードブロック禁止）。
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

【画像】
${imageUrls.join("\n")}

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
    const result = JSON.parse(content);

    // Sheet 書き込み（失敗しても返却は継続）
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
        imageCount: imageUrls.length,
        buyPrice: result.buyPrice,
        sellPrice: result.sellPrice,
        profitRate: result.profitRate,
        reason: result.reason,
      });
    } catch (e) {
      console.error("sheet write failed:", e);
    }

    return res.status(200).json({
      status: "ok",
      result: {
        price_buy: result.buyPrice,
        price_sell: result.sellPrice,
        profit_margin: result.profitRate,
        confidence: result.confidence,
        reasoning: result.reason,
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


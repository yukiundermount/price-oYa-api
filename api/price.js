import OpenAI from "openai";
import { writeSheet } from "./writeSheet.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ===== CORS =====
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
      imageUrls = [], // ← Studio 側で URL 配列として渡す
    } = req.body || {};

    const imageCount = Array.isArray(imageUrls) ? imageUrls.length : 0;

    // ===== プロンプト =====
    const systemPrompt = `
あなたは日本の高級リユース市場（特に時計・ブランド品）専門の鑑定士AIです。
必ず「現実の中古市場で成立する価格」を出してください。
出力は **JSONのみ**。説明文・コードブロック禁止。
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

【販売戦略ルール】
quick_sell:
- 仕入価格は相場下限
- 販売価格は相場中央値未満

balance:
- 仕入価格は相場中央値
- 販売価格は相場中央値

high_price:
- 仕入価格は相場中央値〜上限
- 販売価格は相場上限

【画像】
枚数: ${imageCount}
${imageUrls.map((u, i) => `画像${i + 1}: ${u}`).join("\n")}

【出力JSON】
{
  "buyPrice": number,
  "sellPrice": number,
  "profitRate": number, // 0〜1
  "confidence": number, // 0〜1
  "reason": string,
  "warnings": string[]
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
    const ai = JSON.parse(content);

    // ===== Sheets（失敗してもレスポンスは返す）=====
    try {
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
        buyPrice: ai.buyPrice,
        sellPrice: ai.sellPrice,
        profitRate: ai.profitRate,
        reason: ai.reason,
      });
    } catch (e) {
      console.error("sheet write failed:", e);
    }

    return res.status(200).json({
      status: "ok",
      result: {
        price_buy: ai.buyPrice,
        price_sell: ai.sellPrice,
        profit_margin: Math.round((ai.profitRate || 0) * 100),
        confidence: Math.round((ai.confidence || 0) * 100),
        reasoning: ai.reason,
        warnings: ai.warnings || [],
      },
    });
  } catch (err) {
    console.error("price error:", err);
    return res.status(500).json({ status: "error", message: "査定に失敗しました" });
  }
}


import OpenAI from "openai";
import { writeSheet } from "../lib/writeSheet.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      category,
      brand,
      model,          // 商品モデル名
      condition,
      year,
      accessories,
      strategy,
      imageCount = 0,
    } = req.body;

    /* ===============================
       AI プロンプト（JSON強制）
    =============================== */
    const systemPrompt = `
あなたは中古品のプロ鑑定士です。
必ず「純粋なJSONのみ」を返してください。
文章・説明・装飾は禁止です。
`;

    const userPrompt = `
以下の商品を査定してください。

【条件】
カテゴリ: ${category}
ブランド: ${brand}
モデル: ${model}
状態: ${condition}
年式: ${year}
付属品: ${accessories}
販売戦略: ${strategy}
画像枚数: ${imageCount}

【出力JSON形式】
{
  "buyPrice": number,
  "sellPrice": number,
  "profitRate": number,
  "confidence": number,
  "reason": string
}
`;

    const aiModel = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const completion = await openai.chat.completions.create({
      model: aiModel,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices[0].message.content;

    let result;
    try {
      result = JSON.parse(raw);
    } catch (e) {
      console.error("AI raw response:", raw);
      return res.status(500).json({
        error: "AI pricing failed",
        detail: "AI response is not valid JSON",
      });
    }

    /* ===============================
       必須キー検証
    =============================== */
    const requiredKeys = [
      "buyPrice",
      "sellPrice",
      "profitRate",
      "confidence",
      "reason",
    ];

    for (const key of requiredKeys) {
      if (!(key in result)) {
        return res.status(500).json({
          error: "AI pricing failed",
          detail: `result.${key} is missing`,
        });
      }
    }

    /* ===============================
       Sheets 書き込み
    =============================== */
    await writeSheet({
      category,
      brand,
      model,
      condition,
      year,
      accessories,
      strategy,
      imageCount,
      buyPrice: result.buyPrice,
      sellPrice: result.sellPrice,
      profitRate: result.profitRate,
      confidence: result.confidence,
      reason: result.reason,
    });

    /* ===============================
       正常レスポンス
    =============================== */
    return res.status(200).json({
      ok: true,
      result,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Internal Server Error",
      detail: err.message,
    });
  }
}


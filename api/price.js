import { writeSheet } from "../lib/writeSheet.js";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
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
      model,
      condition,
      year,
      accessories,
      strategy,
      imageUrls = [],
      imageCount = 0,
    } = req.body;

    /* =====================
       1. 🔴 AI価格査定プロンプト（中核）
    ====================== */
    const prompt = `
あなたは日本の中古市場・転売市場に精通したプロの査定士です。
以下の商品情報をもとに、**現実的で実務に使える価格査定**を行ってください。

【商品情報】
- カテゴリ: ${category}
- ブランド: ${brand}
- モデル: ${model}
- 状態: ${condition}
- 製造年: ${year}
- 付属品: ${accessories}
- 販売戦略: ${strategy}
- 商品画像枚数: ${imageCount}枚

【販売戦略の意味】
- quick_sell: 早期売却・相場下限寄り
- balance: 相場中央値
- high_price: 時間をかけて高値狙い

【必須ルール】
- 実在しない価格を作らない
- 日本円で整数
- 極端に安すぎ・高すぎは禁止
- プロ査定として現実的な幅に収める

【出力形式（JSON厳守・文章不可）】
{
  "buyPrice": number,
  "sellPrice": number,
  "profitRate": number,
  "confidence": number,
  "reason": string
}

【補足】
- profitRate = (sellPrice - buyPrice) / buyPrice
- confidence は 50〜90
- reason は150文字以内の日本語
`;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "あなたは中古品の価格査定をJSONで正確に出力するプロフェッショナルです。",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
    });

    /* =====================
       2. AI出力の安全パース
    ====================== */
    let aiResult;
    try {
      aiResult = JSON.parse(completion.choices[0].message.content);
    } catch (e) {
      throw new Error("AIのJSON出力が不正です");
    }

    const {
      buyPrice,
      sellPrice,
      profitRate,
      confidence,
      reason,
    } = aiResult;

    /* =====================
       3. 最低限の防御バリデーション
    ====================== */
    if (
      !buyPrice ||
      !sellPrice ||
      typeof profitRate !== "number" ||
      !reason
    ) {
      throw new Error("AI査定結果に不足があります");
    }

    /* =====================
       4. Google Sheets 保存
    ====================== */
    await writeSheet([
      new Date().toISOString(),
      category,
      brand,
      model,
      condition,
      year,
      accessories,
      strategy,
      imageUrls.join(","),
      imageCount,
      buyPrice,
      sellPrice,
      profitRate,
      confidence,
      reason,
    ]);

    /* =====================
       5. Studioへ返却
    ====================== */
    return res.status(200).json({
      buyPrice,
      sellPrice,
      profitRate,
      confidence,
      reason,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Internal Server Error",
      message: err.message,
    });
  }
}


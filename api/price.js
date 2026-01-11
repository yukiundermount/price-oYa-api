import OpenAI from "openai";
import { writeSheet } from "../lib/writeSheet.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  // CORS
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
      model,
      condition,
      year,
      accessories,
      strategy,
      imageCount = 0,
    } = req.body;

    /* ===============================
       AI 価格査定プロンプト（本体）
    =============================== */
    const prompt = `
あなたは中古市場に精通したプロの鑑定士です。
以下の商品情報から「現実的で売れる価格」を判断してください。

【カテゴリ】
${category}

【ブランド】
${brand}

【モデル】
${model}

【状態】
${condition}

【年式・購入年】
${year}

【付属品】
${accessories}

【販売戦略】
${strategy}
- 早く売りたい：相場よりやや安め
- バランス：相場中央値
- 高く売りたい：時間がかかっても高値

【商品画像枚数】
${imageCount} 枚

--- 出力ルール ---
必ず JSON のみで出力してください。説明文は禁止。

{
  "buy_price": number,        // 想定買取価格（円）
  "sell_price": number,       // 想定販売価格（円）
  "profit_rate": number,      // 利益率（%）
  "reason": string            // 判断理由（日本語）
}
`;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a professional appraiser." },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
    });

    const aiText = completion.choices[0].message.content;

    let result;
    try {
      result = JSON.parse(aiText);
    } catch (e) {
      throw new Error("AI response is not valid JSON");
    }

    const response = {
      buy_price: result.buy_price,
      sell_price: result.sell_price,
      profit_rate: result.profit_rate,
      reason: result.reason,
    };

    // スプレッドシート保存
    await writeSheet({
      category,
      brand,
      model,
      condition,
      year,
      accessories,
      strategy,
      imageCount,
      ...response,
    });

    return res.status(200).json(response);

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "AI pricing failed",
      detail: error.message,
    });
  }
}


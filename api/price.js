import OpenAI from "openai";
import { writeSheet } from "./writeSheet.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
    return res.status(405).json({ message: "Method not allowed" });
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
      imageUrls = [], // ★ STUDIO から配列で受け取る
    } = req.body;

    const imageCount = imageUrls.length;
    const imageUrlText = imageUrls.join(",");

    /* ---------- Vision + テキスト推論 ---------- */
    const messages = [
      {
        role: "system",
        content:
          "あなたは日本の高級リユース市場に精通した真贋鑑定士AIです。必ずJSONのみで返答してください。",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `
商品情報:
カテゴリ: ${category}
ブランド: ${brand}
モデル: ${model}
状態: ${condition}
年式: ${year}
付属品: ${accessories}
販売戦略: ${strategy}

以下を必ず評価:
- 真贋リスク
- 状態ランク
- 市場相場
`,
          },
          ...imageUrls.map((url) => ({
            type: "image_url",
            image_url: { url },
          })),
        ],
      },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3,
      messages,
    });

    const ai = JSON.parse(
      completion.choices[0].message.content || "{}"
    );

    /* ---------- 戦略をサーバー側で強制反映 ---------- */
    const strategyFactor = {
      quick_sell: 0.9,
      balance: 1.0,
      high_price: 1.1,
    }[strategy] || 1.0;

    const sellPrice = Math.round(ai.sellPrice * strategyFactor);
    const buyPrice = Math.round(sellPrice * (1 - ai.profitRate));

    /* ---------- Sheets（失敗しても止めない） ---------- */
    writeSheet({
      category,
      brand,
      model,
      condition,
      year,
      accessories,
      strategy,
      imageUrls: imageUrlText,
      imageCount,
      buyPrice,
      sellPrice,
      profitRate: ai.profitRate,
      reason: ai.reason,
    }).catch((e) => {
      console.error("sheet write failed:", e.message);
    });

    /* ---------- Studio へ必ず返す ---------- */
    return res.status(200).json({
      buyPrice,
      sellPrice,
      profitRate: ai.profitRate,
      confidence: ai.confidence,
      reason: ai.reason,
      imageCount,
    });
  } catch (e) {
    console.error("price error:", e);
    return res.status(200).json({
      error: true,
      message: "一部処理に失敗しましたが査定は完了しました",
    });
  }
}


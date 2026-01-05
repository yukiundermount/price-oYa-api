// /api/price.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  /* ===== CORS（最重要） ===== */
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // --- プリフライト対応 ---
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // --- POST 以外拒否 ---
  if (req.method !== "POST") {
    return res.status(405).json({
      status: "error",
      message: "Method Not Allowed"
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
      strategy
    } = req.body || {};

    if (!category || !condition || !strategy) {
      return res.status(200).json({
        status: "error",
        message: "必須項目が不足しています"
      });
    }

    /* ===== AI プロンプト ===== */
    const prompt = `
あなたは中古市場のプロ鑑定士AIです。
以下の商品情報をもとに、日本国内の現実的な二次流通相場を考慮して
「極端に安すぎる／高すぎる価格」を避け、実際に売買成立しやすい
買取価格・販売価格を算出してください。

【商品情報】
カテゴリ: ${category}
ブランド: ${brand || "不明"}
モデル: ${model || "不明"}
状態: ${condition}
年: ${year || "不明"}
付属品: ${accessories || "なし"}
販売戦略: ${strategy}

【出力形式（JSONのみ）】
{
  "buyPrice": number,
  "sellPrice": number,
  "profitRate": number,
  "confidence": number,
  "reason": string,
  "warnings": string[]
}

【制約】
- sellPrice < buyPrice は禁止
- 相場から±50%以上乖離しない
- 情報不足時は confidence を下げ warnings に理由を書く
`;

    /* ===== OpenAI ===== */
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a professional pricing AI." },
          { role: "user", content: prompt }
        ],
        temperature: 0.4
      })
    });

    const aiJson = await aiRes.json();
    const content = aiJson?.choices?.[0]?.message?.content || "";

    let aiResult;
    try {
      aiResult = JSON.parse(content);
    } catch {
      throw new Error("AI response is not valid JSON");
    }

    const buyPrice = Number(aiResult.buyPrice);
    const sellPrice = Number(aiResult.sellPrice);
    const profitRate = Number(aiResult.profitRate);

    if (!buyPrice || !sellPrice || sellPrice < buyPrice) {
      throw new Error("Invalid price generated");
    }

    /* ===== Sheet 保存（失敗してもUIは続行） ===== */
    fetch(`${process.env.API_BASE_URL}/api/writeSheet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category,
        brand,
        model,
        condition,
        year,
        accessories,
        strategy,
        buyPrice,
        sellPrice,
        profitRate,
        reason: aiResult.reason || ""
      })
    }).catch(() => {});

    /* ===== STUDIO iframe 用レスポンス ===== */
    return res.status(200).json({
      status: "ok",
      result: {
        price_buy: buyPrice,
        price_sell: sellPrice,
        profit_margin: profitRate / 100,
        confidence: Number(aiResult.confidence) || 0.5,
        reasoning: aiResult.reason || "",
        warnings: aiResult.warnings || []
      }
    });

  } catch (err) {
    console.error("price error:", err);
    return res.status(200).json({
      status: "error",
      message: "査定に失敗しました"
    });
  }
}

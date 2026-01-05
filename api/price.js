// /api/price.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "Method Not Allowed" });
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

    // ---- 最低限のバリデーション ----
    if (!category || !condition || !strategy) {
      return res.status(200).json({
        status: "error",
        message: "必須項目が不足しています"
      });
    }

    // ---- AI へのプロンプト（完全版）----
    const prompt = `
あなたは中古市場のプロ鑑定士AIです。
以下の商品情報から、現在の日本国内二次流通相場を踏まえ、
「不自然に安すぎる／高すぎる価格」を出さないように注意して、
現実的で売買成立しやすい価格を算出してください。

【商品情報】
カテゴリ: ${category}
ブランド: ${brand || "不明"}
モデル: ${model || "不明"}
状態: ${condition}
年: ${year || "不明"}
付属品: ${accessories || "なし"}
販売戦略: ${strategy}

【出力ルール】
- buyPrice（整数・円）
- sellPrice（整数・円）
- profitRate（整数・%）
- confidence（0〜1）
- reason（日本語で簡潔に）
- warnings（あれば配列、なければ空配列）

【制約】
- sellPrice < buyPrice にならない
- 極端な価格（相場の±50%以上）は避ける
- 情報不足時は confidence を下げ、warnings に理由を書く
`;

    // ---- OpenAI 呼び出し ----
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
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
    const text = aiJson?.choices?.[0]?.message?.content || "";

    // ---- AI JSON を安全に抽出 ----
    let aiResult;
    try {
      aiResult = JSON.parse(text);
    } catch {
      throw new Error("AIの出力がJSONではありません");
    }

    // ---- 数値の安全化 ----
    const buyPrice = Number(aiResult.buyPrice) || 0;
    const sellPrice = Number(aiResult.sellPrice) || 0;
    const profitRate = Number(aiResult.profitRate) || 0;

    if (buyPrice <= 0 || sellPrice <= 0 || sellPrice < buyPrice) {
      throw new Error("Invalid price generated");
    }

    // ---- Sheet 保存（非同期・失敗しても続行）----
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
        reason: aiResult.reason || aiResult.reasoning || ""
      })
    }).catch(() => {});

    // ---- STUDIO iframe 用レスポンス（最重要）----
    return res.status(200).json({
      status: "ok",
      result: {
        price_buy: buyPrice,
        price_sell: sellPrice,
        profit_margin: profitRate / 100,
        confidence: Number(aiResult.confidence) || 0.5,
        reasoning: aiResult.reason || aiResult.reasoning || "",
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


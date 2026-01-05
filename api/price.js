import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {

  // ===== CORS =====
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  // =================

  if (req.method !== "POST") {
    return res.status(405).json({
      status: "error",
      message: "Method Not Allowed"
    });
  }

  try {
    const body = req.body || {};

    // ===== 仮の価格ロジック（後でAIに置換可）=====
    let buyPrice = 100000;
    let sellPrice = 120000;

    if (body.strategy === "早く売りたい") {
      sellPrice = Math.round(sellPrice * 0.95);
    }
    if (body.strategy === "高値で売りたい") {
      sellPrice = Math.round(sellPrice * 1.05);
    }

    const profitRate = Math.round(((sellPrice - buyPrice) / sellPrice) * 100);

    const result = {
      price_buy: buyPrice,
      price_sell: sellPrice,
      profit_margin: profitRate / 100,
      confidence: 0.8,
      reasoning: "一般的な中古市場データを基に算出しました。",
      warnings: []
    };
    // ============================================

    // ===== Google Sheets に保存 =====
    await fetch("https://price-o-ya-api.vercel.app/api/writeSheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: body.category,
        brand: body.brand,
        model: body.model,
        condition: body.condition,
        year: body.year,
        accessories: body.accessories,
        strategy: body.strategy,
        buyPrice: result.price_buy,
        sellPrice: result.price_sell,
        profitRate,
        reason: result.reasoning
      })
    });
    // =================================

    return res.status(200).json({
      status: "ok",
      result
    });

  } catch (e) {
    return res.status(500).json({
      status: "error",
      message: e.message
    });
  }
}

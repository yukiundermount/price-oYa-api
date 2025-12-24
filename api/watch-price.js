import OpenAI from "openai";

export default async function handler(req, res) {

  // ✅ CORS 対応（最初に書く）
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // ✅ OPTIONS は即OKで返す
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // POST 以外は拒否
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const {
      brand,
      model,
      condition,
      year,
      accessories,
      strategy
    } = req.body;

    if (!brand || !model || !condition) {
      return res.status(400).json({ error: "required fields missing" });
    }

    // --- ここに OpenAI 処理 ---
    res.status(200).json({
      buy_price: 850000,
      sell_price: 1050000,
      profit_rate: "23%",
      ai_reason: "ロレックス デイトナは市場需要が非常に高く…"
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}


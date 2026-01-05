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

    const prompt = `価格査定テスト`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }]
    });

    return res.status(200).json({
      status: "ok",
      result: {
        price_buy: 100000,
        price_sell: 120000,
        profit_margin: 0.2,
        confidence: 0.8,
        reasoning: "テスト",
        warnings: []
      }
    });

  } catch (e) {
    return res.status(500).json({
      status: "error",
      message: e.message
    });
  }
}


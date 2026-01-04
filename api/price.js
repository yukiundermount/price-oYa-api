export default async function handler(req, res) {
  // ===== CORS対応（最重要）=====
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // OPTIONS（プリフライト）は即200で返す
  if (req.method === "OPTIONS") {
    return res.status(200).end();
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
      strategy
    } = req.body;

    // ====== ここは既存のAI計算ロジック ======
    const buyPrice = 900000;
    const sellPrice = 1100000;
    const profitRate = 22;
    const reason = "market demand strong";

    // ====== Sheets書き込みAPIを内部呼び ======
    await fetch("https://price-o-ya-api.vercel.app/api/writeSheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
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
        reason
      })
    });

    // ====== iframeへ結果返却 ======
    return res.status(200).json({
      buyPrice,
      sellPrice,
      profitRate,
      reason
    });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Internal error" });
  }
}


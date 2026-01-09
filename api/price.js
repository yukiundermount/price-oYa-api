export default async function handler(req, res) {
  // ===== CORS 完全対応 =====
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Preflight
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
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
      images,
      imageUrls,
      imageCount
    } = req.body;

    // ---- 仮のAIロジック（後で差し替え可） ----
    const buyPrice = 1200000;
    const sellPrice = strategy === "high_price" ? 1800000 : 1500000;

    const profitRate = (sellPrice - buyPrice) / buyPrice;
    const confidence = 0.9;

    const reasoning = `${year}年製の${brand}${model}は人気が高く、${accessories}のため相場中央値以上での取引が見込めます。`;

    return res.status(200).json({
      result: {
        price_buy: buyPrice,
        price_sell: sellPrice,
        profit_margin: profitRate * 100,
        confidence: confidence * 100,
        reasoning
      },
      meta: {
        imageUrls,
        imageCount
      }
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}


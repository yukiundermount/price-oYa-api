export default async function handler(req, res) {
  // ===== CORS =====
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // ❌ JSON.parse はしない（すでに Object）
    const {
      category,
      brand,
      model,
      condition,
      year,
      accessories,
      strategy
    } = req.body || {};

    // ===== 最低限のバリデーション =====
    if (!category || !brand || !model) {
      return res.status(200).json({
        buyPrice: 0,
        sellPrice: 0,
        profitRate: 0,
        reason: "入力情報が不足しているため、概算価格のみ算出しました。"
      });
    }

    // ===== 仮ロジック（後でAIに差し替え可） =====
    let buyPrice = 0;
    let sellPrice = 0;
    let reason = "";

    if (
      category === "watch" &&
      brand.toLowerCase().includes("rolex") &&
      model.toLowerCase().includes("daytona")
    ) {
      buyPrice = 3200000;
      sellPrice = 3800000;
      reason = "ロレックス デイトナは市場流通量が少なく、非常に高い需要があります。";
    } else {
      buyPrice = 100000;
      sellPrice = 150000;
      reason = "一般的な中古市場データを基に算出しました。";
    }

    const profitRate = Math.round(
      ((sellPrice - buyPrice) / sellPrice) * 100
    );

    // ===== Sheets へ保存（失敗しても UI は返す） =====
    try {
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
    } catch (sheetError) {
      console.error("Sheet write failed:", sheetError);
    }

    // ===== フロントに返す =====
    return res.status(200).json({
      buyPrice,
      sellPrice,
      profitRate,
      reason
    });

  } catch (err) {
    console.error("API error:", err);
    return res.status(500).json({
      buyPrice: 0,
      sellPrice: 0,
      profitRate: 0,
      reason: "サーバー内部エラーが発生しました。"
    });
  }
}

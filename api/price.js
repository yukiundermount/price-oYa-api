import { writeSheet } from "./writeSheet.js";

/**
 * POST /api/price
 * STUDIO からの商品査定リクエストを受け取り
 * 価格算出 → Google Sheets へ保存 → 結果を返却
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // -----------------------------
    // 1. リクエスト body の安全な取得
    // -----------------------------
    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

    const {
      category = "",
      brand = "",
      model = "",
      condition = "",
      year = "",
      accessories = "",
      strategy = "",
    } = body;

    // -----------------------------
    // 2. 画像URLの取得（超重要）
    // -----------------------------
    // STUDIO 側の実装差異に耐える
    // - images: ["url1", "url2"]
    // - imageUrls: "url1,url2"
    const images = Array.isArray(body.images) ? body.images : [];

    const imageUrls = images.length
      ? images.join(",")
      : typeof body.imageUrls === "string"
      ? body.imageUrls
      : "";

    const imageCount = images.length
      ? images.length
      : imageUrls
      ? imageUrls.split(",").filter(Boolean).length
      : 0;

    // -----------------------------
    // 3. 価格ロジック（仮・安定版）
    // ※ 後でAI / Vision判定に置換OK
    // -----------------------------
    let basePrice = 0;

    if (brand.includes("ロレックス") || brand.toUpperCase().includes("ROLEX")) {
      basePrice = 1200000;
    }

    if (strategy === "high_price") {
      basePrice *= 1.25;
    } else if (strategy === "quick_sell") {
      basePrice *= 1.0;
    } else {
      basePrice *= 1.15; // balance
    }

    const buyPrice = Math.round(basePrice);
    const sellPrice = Math.round(basePrice * 1.25);
    const profitRate =
      buyPrice > 0
        ? Number(((sellPrice - buyPrice) / buyPrice).toFixed(3))
        : 0;

    const reason =
      "ブランド人気・状態・付属品および販売戦略を考慮した価格設定です。";

    // -----------------------------
    // 4. Google Sheets に保存
    // -----------------------------
    await writeSheet({
      timestamp: new Date().toISOString(),
      category,
      brand,
      model,
      condition,
      year,
      accessories,
      strategy,
      imageUrls,
      imageCount,
      buyPrice,
      sellPrice,
      profitRate,
      reason,
    });

    // -----------------------------
    // 5. STUDIO に返却
    // -----------------------------
    return res.status(200).json({
      buyPrice,
      sellPrice,
      profitRate,
      confidence: imageCount > 0 ? 0.9 : 0.7,
      reason,
    });
  } catch (err) {
    console.error("price error:", err);
    return res.status(500).json({
      error: "price calculation failed",
    });
  }
}


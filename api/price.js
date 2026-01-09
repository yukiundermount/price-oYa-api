// api/price.js
import { google } from "googleapis";

/**
 * Vercel Serverless Function
 * POST /api/price
 */
export default async function handler(req, res) {
  // CORS
  if (req.method === "OPTIONS") {
    return res.status(204).end();
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
      strategy,
      images = [],
    } = req.body;

    // ==========
    // 仮の価格ロジック（今は安定動作優先）
    // ==========
    let buyPrice = 1200000;
    let sellPrice = 1500000;

    if (strategy === "balance") {
      buyPrice = 1500000;
      sellPrice = 1800000;
    }
    if (strategy === "high_price") {
      buyPrice = 1500000;
      sellPrice = 1900000;
    }

    const profitRate = Number(
      ((sellPrice - buyPrice) / sellPrice).toFixed(2)
    );

    // ==========
    // Google Sheets 書き込み
    // ==========
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GCP_CLIENT_EMAIL,
        private_key: process.env.GCP_PRIVATE_KEY.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const imageUrls =
      images.length > 0
        ? images.map((_, i) => `uploaded_image_${i + 1}`).join(",")
        : "";

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: "Sheet1!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            new Date().toISOString(),
            category,
            brand,
            model,
            condition,
            year,
            accessories,
            strategy,
            imageUrls,
            images.length,
            buyPrice,
            sellPrice,
            profitRate,
            `${year}年製の${brand} ${model}は市場人気が高く、戦略「${strategy}」に基づく価格設定が妥当です。`,
          ],
        ],
      },
    });

    // ==========
    // レスポンス
    // ==========
    return res.status(200).json({
      result: {
        price_buy: buyPrice,
        price_sell: sellPrice,
        profit_margin: profitRate * 100,
        confidence: 90,
        reasoning: `${year}年製の${brand} ${model}は需要が高く、現在の市場状況ではこの価格帯が現実的です。`,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Internal Server Error",
      message: err.message,
    });
  }
}

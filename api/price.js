import { google } from "googleapis";

export default async function handler(req, res) {
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
      imageUrls = [],
      imageCount = 0
    } = req.body;

    /* =========================
       1. 価格ロジック（仮）
    ========================= */

    let buyPrice = 300000;
    let sellPrice = 450000;

    if (strategy === "quick_sell") {
      sellPrice = Math.round(buyPrice * 1.3);
    } else if (strategy === "balance") {
      sellPrice = Math.round(buyPrice * 1.5);
    } else if (strategy === "high_price") {
      sellPrice = Math.round(buyPrice * 1.8);
    }

    const profitRate = Number(
      ((sellPrice - buyPrice) / buyPrice).toFixed(2)
    );

    const reason =
      "2015年製・箱保証書付き・需要の高いモデルのため、現在の市場相場と直近取引事例を基に算出しています。";

    /* =========================
       2. Google Sheets 保存
    ========================= */

    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });

    const sheets = google.sheets({ version: "v4", auth });

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: "Sheet1!A:N",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          new Date().toISOString(), // timestamp
          category,
          brand,
          model,
          condition,
          year,
          accessories,
          strategy,
          imageUrls.join(","), // imageUrls
          imageCount,
          buyPrice,
          sellPrice,
          profitRate,
          reason
        ]]
      }
    });

    /* =========================
       3. フロント返却
    ========================= */

    return res.status(200).json({
      result: {
        buyPrice,
        sellPrice,
        profitRate,
        confidence: 85,
        reason
      }
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Internal Server Error",
      message: err.message
    });
  }
}


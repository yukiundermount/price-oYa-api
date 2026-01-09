const { google } = require("googleapis");

/**
 * =========================
 * Google Sheets 設定
 * =========================
 */
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = "Sheet1";

/**
 * サービスアカウント認証
 */
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

/**
 * =========================
 * API Handler
 * =========================
 */
module.exports = async function handler(req, res) {
  // CORS（OPTIONS 対応）
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = req.body || {};

    // 入力値
    const category = body.category || "";
    const brand = body.brand || "";
    const model = body.model || "";
    const condition = body.condition || "";
    const year = body.year || "";
    const accessories = body.accessories || "";
    const strategy = body.strategy || "";

    // 画像（base64は保存しない）
    const images = Array.isArray(body.images) ? body.images : [];
    const imageCount = images.length;

    const imageUrls =
      imageCount > 0
        ? images.map((_, i) => `uploaded_image_${i + 1}`).join(",")
        : "";

    // ===== 査定ロジック（仮）=====
    const price_buy = 1200000;
    const price_sell = 1500000;

    const profitRate =
      price_sell > 0
        ? Number(((price_sell - price_buy) / price_sell).toFixed(4))
        : 0;

    const confidence = 0.9;

    const reason =
      "2015年製のロレックスデイトナは人気が高く、状態が新しいため、相場中央値を下回る価格での販売が可能。付属品が揃っていることも価値を高めている。";

    // ===== Sheets 書き込み =====
    const timestamp = new Date().toISOString();

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:N`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            timestamp,
            category,
            brand,
            model,
            condition,
            year,
            accessories,
            strategy,
            imageUrls,
            imageCount,
            price_buy,
            price_sell,
            profitRate,
            reason,
          ],
        ],
      },
    });

    // ===== フロント返却 =====
    res.status(200).json({
      result: {
        price_buy,
        price_sell,
        profit_margin: profitRate,
        confidence,
        reasoning: reason,
      },
    });
  } catch (err) {
    console.error("API ERROR:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


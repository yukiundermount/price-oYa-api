import { google } from "googleapis";

/**
 * POST /api/watch-price
 */
export default async function handler(req, res) {
  // CORS（Glide / STUDIO 用）
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // ==========
    // 環境変数チェック
    // ==========
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_JSON");
    }
    if (!process.env.SPREADSHEET_ID) {
      throw new Error("Missing SPREADSHEET_ID");
    }

    // ==========
    // リクエストBody
    // ==========
    const {
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
    } = req.body;

    // ==========
    // Google Auth（★ここが最重要）
    // ==========
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });

    const sheets = google.sheets({
      version: "v4",
      auth
    });

    // ==========
    // スプレッドシートに追記
    // ==========
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: "シート1!A:Z",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          new Date().toISOString(),
          category ?? "",
          brand ?? "",
          model ?? "",
          condition ?? "",
          year ?? "",
          accessories ?? "",
          strategy ?? "",
          buyPrice ?? "",
          sellPrice ?? "",
          profitRate ?? "",
          reason ?? ""
        ]]
      }
    });

    // ==========
    // 成功レスポンス
    // ==========
    return res.status(200).json({
      status: "ok"
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: "error",
      message: err.message
    });
  }
}



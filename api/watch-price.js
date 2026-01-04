import { google } from "googleapis";

export default async function handler(req, res) {
  // CORS（Glide / STUDIO 用）
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    /* ========= 環境変数チェック ========= */
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_JSON");
    }
    if (!process.env.SPREADSHEET_ID) {
      throw new Error("Missing SPREADSHEET_ID");
    }

    /* ========= サービスアカウント読み込み ========= */
    const credentials = JSON.parse(
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    );

    const auth = new google.auth.JWT({
      client_email: credentials.client_email,
      private_key: credentials.private_key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    /* ========= 受信データ ========= */
    const body = req.body;

    /* ========= スプレッドシート追記 ========= */
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: "Sheet1!A1",
      valueInputOption: "RAW",
      requestBody: {
        values: [
          [
            new Date().toISOString(),
            body?.title ?? "",
            body?.price ?? "",
            body?.category ?? "",
          ],
        ],
      },
    });

    return res.status(200).json({
      status: "ok",
      message: "Sheet updated",
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: err.message,
    });
  }
}

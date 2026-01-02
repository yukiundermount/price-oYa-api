import { google } from "googleapis";

/**
 * POST /api/watch-price
 */
export default async function handler(req, res) {
  // --- CORS（Glide / STUDIO 用） ---
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
    // --- 必須環境変数チェック ---
    const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

    if (!SERVICE_ACCOUNT_EMAIL) {
      throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL");
    }
    if (!SPREADSHEET_ID) {
      throw new Error("Missing SPREADSHEET_ID");
    }

    // --- IAM（鍵なし）で Google 認証 ---
    const auth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      clientOptions: {
        client_email: SERVICE_ACCOUNT_EMAIL,
      },
    });

    const authClient = await auth.getClient();

    // --- Sheets API ---
    const sheets = google.sheets({
      version: "v4",
      auth: authClient,
    });

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
      reason,
    } = req.body;

    const timestamp = new Date().toISOString();

    // --- 追記 ---
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "シート1!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          timestamp,
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
          reason,
        ]],
      },
    });

    return res.status(200).json({
      status: "ok",
      message: "Spreadsheet updated",
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: "error",
      message: err.message,
    });
  }
}



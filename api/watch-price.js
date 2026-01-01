import { google } from "googleapis";

export default async function handler(req, res) {
  // ===== CORS =====
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    // ===== bodyチェック =====
    if (!req.body) {
      return res.status(400).json({ error: "Request body is missing" });
    }

    const {
      category,
      brand,
      model,
      condition,
      year,
      accessories,
      strategy,
      price,
    } = req.body;

    if (!category || !price) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // ===== Google認証 =====
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      return res.status(500).json({ error: "Service account not set" });
    }

    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const spreadsheetId = process.env.SPREADSHEET_ID;
    const sheetName = process.env.SHEET_NAME || "Sheet1";

    if (!spreadsheetId) {
      return res.status(500).json({ error: "SPREADSHEET_ID is missing" });
    }

    // ===== Sheets追記 =====
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          new Date().toISOString(),
          category,
          brand,
          model,
          condition,
          year,
          accessories,
          strategy,
          price,
        ]],
      },
    });

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Internal Server Error",
      detail: err.message,
    });
  }
}


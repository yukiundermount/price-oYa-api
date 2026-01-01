export default async function handler(req, res) {
  // ✅ CORS preflight 対応
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // ↓↓↓ ここから既存の POST 処理 ↓↓↓
}



import { google } from "googleapis";

export default async function handler(req, res) {
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
      buyPrice,
      sellPrice,
      profitRate,
      reason,
    } = req.body || {};

    if (!category || !brand || !model) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // 🔴 ここが超重要
    const credentials = JSON.parse(
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    );

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const spreadsheetId = process.env.SPREADSHEET_ID;
    if (!spreadsheetId) {
      throw new Error("SPREADSHEET_ID is not set");
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "シート1!A1",
      valueInputOption: "RAW",
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
          buyPrice,
          sellPrice,
          profitRate,
          reason,
        ]],
      },
    });

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}

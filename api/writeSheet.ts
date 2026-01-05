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
    } = req.body;

    // JST timestamp
    const jst = new Date(
      new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
    ).toISOString().replace("T", " ").substring(0, 19);

    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      undefined,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      ["https://www.googleapis.com/auth/spreadsheets"]
    );

    const sheets = google.sheets({ version: "v4", auth });

    const values = [[
      jst,
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
    ]];

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: "シート1!A:L",
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });

    res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error("writeSheet error:", err);
    res.status(500).json({ error: "Sheet write failed" });
  }
}

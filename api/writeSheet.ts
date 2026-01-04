import { google } from "googleapis";

export default async function handler(req: any, res: any) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
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
    } = req.body;

    // ① 認証
    const auth = new google.auth.JWT(
      process.env.GOOGLE_CLIENT_EMAIL,
      undefined,
      process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      ["https://www.googleapis.com/auth/spreadsheets"]
    );

    const sheets = google.sheets({ version: "v4", auth });

    // ② 1行追記
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: "シート1!A:Z",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          timestamp ?? new Date().toISOString(),
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

    return res.status(200).json({ status: "ok" });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({
      error: "failed_to_write_sheet",
      detail: err.message,
    });
  }
}

import { google } from "googleapis";

export async function writeSheet(row) {
  try {
    // -----------------------------
    // 1. Service Account 認証
    // -----------------------------
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
    }

    const credentials = JSON.parse(
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    );

    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // -----------------------------
    // 2. 書き込みデータ（列順厳守）
    // -----------------------------
    const values = [[
      row.timestamp || "",
      row.category || "",
      row.brand || "",
      row.model || "",
      row.condition || "",
      row.year || "",
      row.accessories || "",
      row.strategy || "",
      row.imageUrls || "",
      Number(row.imageCount || 0),
      Number(row.buyPrice || 0),
      Number(row.sellPrice || 0),
      Number(row.profitRate || 0),
      row.reason || "",
    ]];

    // -----------------------------
    // 3. Append（A:N 固定）
    // -----------------------------
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: `${process.env.SHEET_NAME}!A:N`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });

    return true;
  } catch (err) {
    console.error("sheet write failed:", err);
    throw err;
  }
}

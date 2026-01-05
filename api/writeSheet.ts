import { google } from "googleapis";

export default async function writeSheet(data: any) {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });

  const sheets = google.sheets({ version: "v4", auth });

  const spreadsheetId = process.env.SPREADSHEET_ID!;
  const sheetName = "シート1";

  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000)
    .toISOString()
    .replace("T", " ")
    .replace("Z", "");

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        jst,
        data.category,
        data.brand,
        data.model,
        data.condition,
        data.year,
        data.accessories,
        data.strategy,
        data.buyPrice,
        data.sellPrice,
        data.profitRate,
        data.reason
      ]]
    }
  });
}

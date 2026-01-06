import { google } from "googleapis";

const auth = new google.auth.JWT(
  process.env.GOOGLE_CLIENT_EMAIL,
  null,
  process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  ["https://www.googleapis.com/auth/spreadsheets"]
);

const sheets = google.sheets({ version: "v4", auth });

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = "price_logs";

export async function writeSheet(data) {
  const values = [[
    new Date().toISOString(),
    data.category,
    data.brand,
    data.model,
    data.condition,
    data.year,
    data.accessories,
    data.strategy,
    data.imageUrls,
    data.imageCount,
    data.buyPrice,
    data.sellPrice,
    data.profitRate,
    data.reason,
  ]];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: SHEET_NAME, // ← A1は絶対に書かない
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values,
    },
  });
}

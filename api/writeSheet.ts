import { google } from "googleapis";

const auth = new google.auth.JWT(
  process.env.GOOGLE_CLIENT_EMAIL,
  null,
  process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  ["https://www.googleapis.com/auth/spreadsheets"]
);

const sheets = google.sheets({ version: "v4", auth });

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
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: "price_logs!A:N",
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

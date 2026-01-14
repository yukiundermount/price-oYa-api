import { google } from "googleapis";

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

export async function writeSheet(data) {
  const spreadsheetId = process.env.SPREADSHEET_ID;

  const values = [[
    new Date().toISOString(),
    data.category,
    data.brand,
    data.model,
    data.condition,
    data.year,
    data.accessories,
    data.strategy,
    data.imageUrls || "",
    data.imageCount || 0,
    data.buyPrice,
    data.sellPrice,
    data.profitRate,
    data.confidence,
    data.reason,
  ]];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Sheet1!A:O",
    valueInputOption: "RAW",
    requestBody: { values },
  });
}


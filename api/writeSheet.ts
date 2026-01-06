import { google } from "googleapis";

export default async function writeSheet(data) {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  const spreadsheetId = process.env.SPREADSHEET_ID;

  const now = new Date().toISOString();

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "シート1!A1",
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        now,
        data.category,
        data.brand,
        data.model,
        data.condition,
        data.year,
        data.accessories,
        data.strategy,
        imageUrls?.join("\n") || "",
        imageUrls?.length || 0,
        data.buyPrice,
        data.sellPrice,
        data.profitRate,
        data.reason
      ]]
    }
  });
}

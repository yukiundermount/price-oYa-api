import { google } from "googleapis";

export async function writeSheet(data) {
  const {
    category,
    brand,
    model,
    condition,
    year,
    accessories,
    strategy,
    imageUrls = [],
    imageCount = 0,
    buyPrice,
    sellPrice,
    profitRate,
    reason,
  } = data;

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  }

  const credentials = JSON.parse(
    Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_JSON, "base64").toString("utf8")
  );

  const auth = new google.auth.JWT(
    credentials.client_email,
    null,
    credentials.private_key,
    ["https://www.googleapis.com/auth/spreadsheets"]
  );

  const sheets = google.sheets({ version: "v4", auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: "price_logs!A1",
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
        imageUrls.join("\n"),
        imageCount,
        buyPrice,
        sellPrice,
        profitRate,
        reason,
      ]],
    },
  });
}

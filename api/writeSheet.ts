import { google } from "googleapis";

const sheets = google.sheets("v4");

export async function writeSheet(data: any) {
  const values = [[
    new Date().toISOString(),          // timestamp
    data.category ?? "",
    data.brand ?? "",
    data.model ?? "",
    data.condition ?? "",
    data.year ?? "",
    data.accessories ?? "",
    data.strategy ?? "",
    (data.imageUrls || []).join("\n"), // imageUrls
    data.imageCount ?? 0,              // imageCount
    data.buyPrice ?? "",
    data.sellPrice ?? "",
    data.profitRate ?? "",
    data.reason ?? "",
  ]];

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SPREADSHEET_ID!,
    range: "price_logs!A1",
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

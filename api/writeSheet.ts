import { google } from "googleapis";

const sheets = google.sheets("v4");

export async function writeSheet(data: any) {
  // ★ imageUrls は使わない
  const imageInfo = Array.isArray(data.imageInfo)
    ? data.imageInfo
    : [];

  const values = [[
    new Date().toISOString(),
    data.category ?? "",
    data.brand ?? "",
    data.model ?? "",
    data.condition ?? "",
    data.year ?? "",
    data.strategy ?? "",
    data.aiPrice ?? "",
    data.buyPrice ?? "",
    data.margin ?? "",
    JSON.stringify(imageInfo), // ← ここが画像欄
    data.aiReason ?? ""
  ]];

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SPREADSHEET_ID!,
    range: "price_logs!A1",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values
    }
  });
}

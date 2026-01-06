import { google } from "googleapis";

const auth = new google.auth.JWT(
  process.env.GOOGLE_CLIENT_EMAIL,
  undefined,
  process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  ["https://www.googleapis.com/auth/spreadsheets"]
);

const sheets = google.sheets({
  version: "v4",
  auth,
});

export async function writeSheet(data: any) {
  const imageInfo = Array.isArray(data.imageInfo) ? data.imageInfo : [];

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
    JSON.stringify(imageInfo),
    data.aiReason ?? ""
  ]];

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SPREADSHEET_ID!,
    range: "Sheet1!A1",
    valueInputOption: "USER_ENTERED",
    requestBody: { values }
  });
}

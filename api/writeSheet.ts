// /api/writeSheet.ts
import { google } from "googleapis";

type WriteSheetParams = {
  category: string;
  brand: string;
  model: string;
  condition: string;
  year: number | string;
  accessories: string;
  strategy: string;

  imageUrls: string[];   // ← 配列で受け取る
  buyPrice: number;
  sellPrice: number;

  profitRate: number;   // 0〜1
  confidence: number;   // 0〜1
  reason: string;
};

export async function writeSheet(params: WriteSheetParams) {
  // ========= 1. 環境変数チェック =========
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  }
  if (!process.env.SPREADSHEET_ID) {
    throw new Error("SPREADSHEET_ID is not set");
  }

  // ========= 2. サービスアカウント認証 =========
  const credentials = JSON.parse(
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  );

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({
    version: "v4",
    auth,
  });

  // ========= 3. データ整形 =========
  const timestamp = new Date().toISOString();

  const imageUrlsString =
    params.imageUrls && params.imageUrls.length > 0
      ? params.imageUrls.join(",")
      : "";

  const imageCount = params.imageUrls
    ? params.imageUrls.length
    : 0;

  // profitRate / confidence は **0〜1のまま保存**
  const row = [
    timestamp,                 // A timestamp
    params.category,            // B category
    params.brand,               // C brand
    params.model,               // D model
    params.condition,           // E condition
    params.year,                // F year
    params.accessories,         // G accessories
    params.strategy,            // H strategy
    imageUrlsString,            // I imageUrls
    imageCount,                 // J imageCount
    params.buyPrice,            // K buyPrice
    params.sellPrice,           // L sellPrice
    params.profitRate,          // M profitRate (0〜1)
    params.reason               // N reason
  ];

  // ========= 4. Sheets に append =========
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: "Sheet1!A:N",
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [row],
    },
  });
}

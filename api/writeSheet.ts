import { google } from "googleapis";

/**
 * Google Sheets に1行書き込む
 */
export async function writeSheet(row: {
  timestamp: string;
  category: string;
  brand: string;
  model: string;
  condition: string;
  year: number | string;
  accessories: string;
  strategy: string;
  imageUrls: string[];
  buyPrice: number;
  sellPrice: number;
  profitRate: number; // 0.2 = 20%
  reason: string;
}) {
  // ================================
  // 1. 環境変数チェック
  // ================================
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  }
  if (!process.env.SPREADSHEET_ID) {
    throw new Error("SPREADSHEET_ID is not set");
  }

  // ================================
  // 2. 認証情報
  // ================================
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

  // ================================
  // 3. 値の正規化
  // ================================
  const imageUrlsJoined =
    row.imageUrls && row.imageUrls.length > 0
      ? row.imageUrls.join(",")
      : "";

  const imageCount = row.imageUrls ? row.imageUrls.length : 0;

  // 利益率：必ず 0〜1 に収める
  const normalizedProfitRate = Math.max(
    0,
    Math.min(row.profitRate, 1)
  );

  // 表示用％（0〜100）
  const profitRatePercent = Number(
    (normalizedProfitRate * 100).toFixed(1)
  );

  // ================================
  // 4. 書き込み行
  // ================================
  const values = [
    [
      row.timestamp,
      row.category,
      row.brand,
      row.model,
      row.condition,
      row.year,
      row.accessories,
      row.strategy,
      imageUrlsJoined,
      imageCount,
      row.buyPrice,
      row.sellPrice,
      profitRatePercent,
      row.reason,
    ],
  ];

  // ================================
  // 5. Sheets append
  // ================================
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: "Sheet1!A:N",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values,
    },
  });
}

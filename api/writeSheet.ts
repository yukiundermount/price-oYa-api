import { google } from "googleapis";

/**
 * Google Sheets 認証（サービスアカウント）
 */
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

/**
 * Google Sheets に1行追加する
 * ※ シート列順に完全一致させること（超重要）
 */
export async function writeSheet(data: any) {
  // 画像情報（未使用でもズレ防止のため必ず用意）
  const imageInfo = Array.isArray(data.imageInfo) ? data.imageInfo : [];

  /**
   * ▼ Sheets の列構成（あなたのシート）
   *
   * A timestamp
   * B category
   * C brand
   * D model
   * E condition
   * F year
   * G accessories
   * H strategy
   * I imageUrls
   * J imageCount
   * K buyPrice
   * L sellPrice
   * M profitRate
   * N reason
   */
  const values = [[
    new Date().toISOString(),        // A timestamp
    data.category ?? "",             // B category
    data.brand ?? "",                // C brand
    data.model ?? "",                // D model
    data.condition ?? "",            // E condition
    data.year ?? "",                 // F year
    data.accessories ?? "",          // G accessories
    data.strategy ?? "",             // H strategy
    JSON.stringify(imageInfo),       // I imageUrls（仮：imageInfo を保存）
    imageInfo.length,                // J imageCount
    data.buyPrice ?? "",             // K buyPrice
    data.sellPrice ?? "",            // L sellPrice
    data.profitRate ?? "",           // M profitRate
    data.reason ?? "",               // N reason
  ]];

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SPREADSHEET_ID!,
    range: "Sheet1!A1",              // ← シート名が Sheet1 の場合
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

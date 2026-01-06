import { google } from "googleapis";

/**
 * 環境変数
 * - GOOGLE_SERVICE_ACCOUNT_EMAIL
 * - GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
 * - SPREADSHEET_ID
 */
const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n"
  ),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

/**
 * price ログを書き込む
 * ※ 失敗しても throw しない（API を落とさない）
 */
export async function writeSheet(data: {
  timestamp: string;
  category?: string;
  brand?: string;
  model?: string;
  condition?: string;
  year?: number | string;
  accessories?: string;
  strategy?: string;
  imageUrls?: string;
  imageCount?: number;
  buyPrice?: number;
  sellPrice?: number;
  profitRate?: number;
  reason?: string;
}) {
  try {
    const spreadsheetId = process.env.SPREADSHEET_ID;
    if (!spreadsheetId) {
      throw new Error("SPREADSHEET_ID is not defined");
    }

    /**
     * ✅ A〜N 列に完全一致
     * timestamp | category | brand | model | condition | year | accessories |
     * strategy | imageUrls | imageCount | buyPrice | sellPrice | profitRate | reason
     */
    const values = [
      [
        data.timestamp ?? new Date().toISOString(),
        data.category ?? "",
        data.brand ?? "",
        data.model ?? "",
        data.condition ?? "",
        data.year ?? "",
        data.accessories ?? "",
        data.strategy ?? "",
        data.imageUrls ?? "",
        data.imageCount ?? 0,
        data.buyPrice ?? 0,
        data.sellPrice ?? 0,
        data.profitRate ?? 0,
        data.reason ?? "",
      ],
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Sheet1!A:N", // ← ★ ここが最重要（A1 ではない）
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values,
      },
    });

    console.log("✅ sheet write success");
  } catch (err) {
    console.error("❌ sheet write failed:", err);
    // ★ throw しない（price API を成功させる）
  }
}


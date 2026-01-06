import { google } from "googleapis";

/**
 * env:
 * - GOOGLE_SERVICE_ACCOUNT_EMAIL
 * - GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
 * - SPREADSHEET_ID
 */

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").replace(
    /\\n/g,
    "\n"
  ),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

export async function writeSheet(data) {
  try {
    const spreadsheetId = process.env.SPREADSHEET_ID;
    if (!spreadsheetId) throw new Error("SPREADSHEET_ID is not defined");

    // A〜N: timestamp, category, brand, model, condition, year, accessories,
    // strategy, imageUrls, imageCount, buyPrice, sellPrice, profitRate, reason
    const values = [
      [
        data.timestamp || new Date().toISOString(),
        data.category || "",
        data.brand || "",
        data.model || "",
        data.condition || "",
        data.year ?? "",
        data.accessories || "",
        data.strategy || "",
        data.imageUrls || "",
        Number.isFinite(data.imageCount) ? data.imageCount : 0,
        Number.isFinite(data.buyPrice) ? data.buyPrice : 0,
        Number.isFinite(data.sellPrice) ? data.sellPrice : 0,
        Number.isFinite(data.profitRate) ? data.profitRate : 0,
        data.reason || "",
      ],
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Sheet1!A:N", // ★ A1 ではなく A:N にする（range parse error対策）
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });

    console.log("✅ sheet write success");
  } catch (err) {
    console.error("❌ sheet write failed:", err);
    // ★ price APIを落とさない
  }
}


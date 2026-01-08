import { google } from "googleapis";

type WriteSheetInput = {
  category: string;
  brand: string;
  model: string;
  condition: string;
  year: number | string;
  accessories: string;
  strategy: string;

  imageUrls: string[];   // 画像URL配列
  imageCount: number;

  buyPrice: number;
  sellPrice: number;
  profitRate: number;    // 0.25 のような実数
  reason: string;
};

export async function writeSheet(data: WriteSheetInput) {
  try {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
    }

    const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);

    const auth = new google.auth.JWT(
      creds.client_email,
      undefined,
      creds.private_key,
      ["https://www.googleapis.com/auth/spreadsheets"]
    );

    const sheets = google.sheets({ version: "v4", auth });

    const spreadsheetId = process.env.SPREADSHEET_ID;
    if (!spreadsheetId) {
      throw new Error("SPREADSHEET_ID is not set");
    }

    const timestamp = new Date().toISOString();

    const values = [
      [
        timestamp,                    // A timestamp
        data.category,                // B category
        data.brand,                   // C brand
        data.model,                   // D model
        data.condition,               // E condition
        data.year,                    // F year
        data.accessories,             // G accessories
        data.strategy,                // H strategy
        data.imageUrls.join(","),     // I imageUrls
        data.imageCount,              // J imageCount
        data.buyPrice,                // K buyPrice
        data.sellPrice,               // L sellPrice
        data.profitRate,              // M profitRate (0.25)
        data.reason                   // N reason
      ]
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Sheet1!A:N",
      valueInputOption: "RAW",
      requestBody: { values }
    });

    return { ok: true };
  } catch (err) {
    console.error("sheet write failed:", err);
    return { ok: false, error: String(err) };
  }
}


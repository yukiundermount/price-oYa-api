import { google } from "googleapis";

function getAuth() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    throw new Error("Missing GOOGLE_CLIENT_EMAIL / GOOGLE_PRIVATE_KEY");
  }

  return new google.auth.GoogleAuth({
    credentials: { client_email: clientEmail, private_key: privateKey },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

export async function writeSheet(data) {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) throw new Error("Missing SPREADSHEET_ID");

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const imageUrlsStr = Array.isArray(data.imageUrls) ? data.imageUrls.join(",") : "";

  // A〜N（14列）に合わせる：timestampも含めて14個
  const values = [[
    new Date().toISOString(),      // A timestamp
    data.category || "",           // B
    data.brand || "",              // C
    data.model || "",              // D
    data.condition || "",          // E
    data.year || "",               // F
    data.accessories || "",        // G
    data.strategy || "",           // H
    imageUrlsStr,                  // I imageUrls
    Number(data.imageCount || 0),  // J imageCount
    Number(data.buyPrice || 0),    // K buyPrice
    Number(data.sellPrice || 0),   // L sellPrice
    Number(data.profitRate || 0),  // M profitRate
    data.reason || "",             // N reason
  ]];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Sheet1!A:N",
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });
}

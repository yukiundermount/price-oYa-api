import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// JST 時刻を文字列で生成
function getJSTTimestamp() {
  return new Date().toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

export default async function handler(req: any, res: any) {
  // ===== CORS =====
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  // =================

  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "Method Not Allowed" });
  }

  try {
    const body = req.body;

    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY as string),
      scopes: SCOPES
    });

    const sheets = google.sheets({ version: "v4", auth });

    const values = [[
      getJSTTimestamp(),                 // timestamp（JST）
      body.category || "",
      body.brand || "",
      body.model || "",
      body.condition || "",
      body.year || "",
      body.accessories || "",
      body.strategy || "",
      body.buyPrice || 0,
      body.sellPrice || 0,
      body.profitRate || 0,
      body.reason || ""
    ]];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "シート1!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: { values }
    });

    return res.status(200).json({ status: "ok" });

  } catch (e: any) {
    return res.status(500).json({
      status: "error",
      message: e.message
    });
  }
}

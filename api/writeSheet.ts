import { google } from "googleapis";

// ===== 設定 =====
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// JST タイムスタンプ生成
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
    return res.status(405).json({
      status: "error",
      message: "Method Not Allowed"
    });
  }

  try {
    // ===== 環境変数チェック（デバッグ用）=====
    if (!process.env.GOOGLE_PRIVATE_KEY || !process.env.GOOGLE_CLIENT_EMAIL) {
      throw new Error("Google service account env vars are missing");
    }
    // ========================================

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        // Vercelでは改行が \n のまま入るため置換必須
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
      },
      scopes: SCOPES
    });

    const sheets = google.sheets({ version: "v4", auth });

    const body = req.body || {};

    const values = [[
      getJSTTimestamp(),           // timestamp (JST)
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
    console.error("writeSheet error:", e);

    return res.status(500).json({
      status: "error",
      message: e.message
    });
  }
}

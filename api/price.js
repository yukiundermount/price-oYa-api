import { google } from "googleapis";

export const config = {
  runtime: "nodejs",
};

function getAuth() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail) throw new Error("GOOGLE_CLIENT_EMAIL is not set");
  if (!privateKey) throw new Error("GOOGLE_PRIVATE_KEY is not set");

  return new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey.replace(/\\n/g, "\n"),
    },
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
  });
}

export default async function handler(req, res) {
  // ===== CORS =====
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const auth = getAuth();
    const sheets = google.sheets({ version: "v4", auth });

    const body = req.body;

    // ===== ダミー査定結果（後でAIに置換）=====
    const result = {
      price_buy: 1200000,
      price_sell: 1500000,
      profit_margin: 25,
      confidence: 92,
      reasoning:
        "2015年製ロレックス デイトナは国内外で需要が高く、付属品完備のため安定した価格で取引されています。",
    };

    // ===== Sheets に書き込む1行 =====
    const row = [
      new Date().toISOString(),            // timestamp
      body.category ?? "",
      body.brand ?? "",
      body.model ?? "",
      body.condition ?? "",
      body.year ?? "",
      body.accessories ?? "",
      body.strategy ?? "",
      (body.imageUrls ?? []).join(","),    // imageUrls
      body.imageCount ?? 0,
      result.price_buy,
      result.price_sell,
      result.profit_margin / 100,          // profitRate（0.25）
      result.reasoning,
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: "Sheet1!A:N",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [row],
      },
    });

    // ===== STUDIO に返す =====
    return res.status(200).json({
      result,
      saved: true,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Internal Server Error",
      message: err.message,
    });
  }
}

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
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/spreadsheets",
    ],
  });
}

export default async function handler(req, res) {
  // ===== CORS =====
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  // Google Auth（接続確認）
  getAuth();

  // ===== ダミー査定結果（STUDIO完全一致）=====
  const result = {
    price_buy: 1200000,
    price_sell: 1500000,
    profit_margin: 25,   // ← % で返す（STUDIOでMath.roundしているため）
    confidence: 92,      // ← 査定信頼度 %
    reasoning: "2015年製ロレックス デイトナは国内外で需要が高く、付属品完備のため安定した価格で取引されています。"
  };

  return res.status(200).json({ result });
}

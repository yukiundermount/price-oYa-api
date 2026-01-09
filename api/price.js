import { google } from "googleapis";

export const config = {
  runtime: "nodejs",
};

/**
 * Google Auth を安全に生成
 */
function getAuth() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail) {
    throw new Error("GOOGLE_CLIENT_EMAIL is not set");
  }

  if (!privateKey) {
    throw new Error("GOOGLE_PRIVATE_KEY is not set");
  }

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

/**
 * API Handler
 */
export default async function handler(req, res) {
  // ===== CORS =====
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // ===== Google Auth 初期化（※ 今回は未使用だが接続確認のため残す）=====
  getAuth();

  // ===== STEP1：STUDIO表示確認用のダミー結果 =====
  return res.status(200).json({
    result: {
      buyPrice: 1200000,
      sellPrice: 1500000,
      profitRate: 0.25,
      reason: "テスト：2015年製ロレックス デイトナの参考相場より算出",
    },
  });
}

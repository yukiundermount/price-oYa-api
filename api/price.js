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
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  // GoogleAuth（接続確認。ここで落ちたらenv不備）
  getAuth();

  // ===== 必ず数値になる値（undefined回避）=====
  const buyPrice = 1200000;
  const sellPrice = 1500000;
  const profitRate = 0.25;
  const reason = "テスト：2015年製ロレックス デイトナの参考相場より算出";

  // ===== STUDIOの取り出し方が不明なので “全部返す” =====
  return res.status(200).json({
    // パターンA: result配下
    result: { buyPrice, sellPrice, profitRate, reason },

    // パターンB: 直下
    buyPrice,
    sellPrice,
    profitRate,
    reason,

    // パターンC: snake_case（念のため）
    buy_price: buyPrice,
    sell_price: sellPrice,
    profit_rate: profitRate,

    ok: true,
  });
}

import { google } from "googleapis";

export const config = {
  runtime: "nodejs",
};

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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // CORS preflight
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // ここで初めて GoogleAuth を生成
  const auth = getAuth();

  const drive = google.drive({ version: "v3", auth });
  const sheets = google.sheets({ version: "v4", auth });

  // 動作確認用
  return res.status(200).json({ ok: true });
}

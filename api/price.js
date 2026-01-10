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
    const drive = google.drive({ version: "v3", auth });

    const body = req.body;

    // ===== ダミー査定結果 =====
    const result = {
      price_buy: 1200000,
      price_sell: 1500000,
      profit_margin: 25,
      confidence: 92,
      reasoning:
        "2015年製ロレックス デイトナは国内外で需要が高く、付属品完備のため安定した価格で取引されています。",
    };

    // ===== 画像を Drive に保存 =====
    const uploadedImageUrls = [];

    if (Array.isArray(body.images)) {
      for (let i = 0; i < body.images.length; i++) {
        const buffer = Buffer.from(body.images[i], "base64");
        const fileName = `price-o-ya_${Date.now()}_${i + 1}.jpg`;

        const file = await drive.files.create({
          requestBody: {
            name: fileName,
            parents: [process.env.DRIVE_FOLDER_ID],
          },
          media: {
            mimeType: "image/jpeg",
            body: buffer,
          },
          fields: "id",
        });

        const fileId = file.data.id;

        await drive.permissions.create({
          fileId,
          requestBody: {
            role: "reader",
            type: "anyone",
          },
        });

        uploadedImageUrls.push(
          `https://drive.google.com/uc?id=${fileId}`
        );
      }
    }

    // ===== Sheets に書き込み =====
    const row = [
      new Date().toISOString(),
      body.category || "",
      body.brand || "",
      body.model || "",
      body.condition || "",
      body.year || "",
      body.accessories || "",
      body.strategy || "",
      uploadedImageUrls.join(","),
      uploadedImageUrls.length,
      result.price_buy,
      result.price_sell,
      result.profit_margin / 100,
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

    return res.status(200).json({
      result,
      images: uploadedImageUrls,
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


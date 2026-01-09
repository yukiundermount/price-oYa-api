import type { VercelRequest, VercelResponse } from "vercel";
import { google } from "googleapis";

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GCP_CLIENT_EMAIL,
    private_key: process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets",
  ],
});

const drive = google.drive({ version: "v3", auth });
const sheets = google.sheets({ version: "v4", auth });

const FOLDER_ID = process.env.DRIVE_FOLDER_ID!;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.status(204).end();
    return;
  }

  try {
    const {
      category, brand, model, condition, year,
      accessories, strategy,
      images = [],
    } = req.body;

    /** ① 画像を Drive に保存 */
    const imageUrls: string[] = [];

    for (let i = 0; i < images.length; i++) {
      const buffer = Buffer.from(images[i], "base64");

      const file = await drive.files.create({
        requestBody: {
          name: `${Date.now()}_${i + 1}.jpg`,
          parents: [FOLDER_ID],
        },
        media: {
          mimeType: "image/jpeg",
          body: buffer,
        },
        fields: "id",
      });

      const fileId = file.data.id!;
      await drive.permissions.create({
        fileId,
        requestBody: { role: "reader", type: "anyone" },
      });

      imageUrls.push(`https://drive.google.com/file/d/${fileId}/view`);
    }

    /** ② Sheets に書き込み */
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "Sheet1!A1",
      valueInputOption: "RAW",
      requestBody: {
        values: [[
          new Date().toISOString(),
          category,
          brand,
          model,
          condition,
          year,
          accessories,
          strategy,
          imageUrls.join(","),
          imageUrls.length,
        ]],
      },
    });

    /** ③ 査定結果（仮） */
    res.status(200).json({
      result: {
        price_buy: 1200000,
        price_sell: 1500000,
        profit_margin: 25,
        confidence: 90,
        reasoning: "2015年製ロレックスデイトナは人気が高く…",
      },
    });

  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}


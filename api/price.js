import OpenAI from "openai";
import { google } from "googleapis";
import formidable from "formidable";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false,
  },
  runtime: "nodejs",
};

/* =========================
   Google Auth
========================= */
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  },
  scopes: [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets",
  ],
});

const drive = google.drive({ version: "v3", auth });
const sheets = google.sheets({ version: "v4", auth });

/* =========================
   OpenAI
========================= */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* =========================
   Handler
========================= */
export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    /* =========================
       Form Parse
    ========================= */
    const form = formidable({ multiples: true });

    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const {
      category,
      condition,
      year,
      accessories,
      strategy,
    } = fields;

    /* =========================
       Image Upload (optional)
    ========================= */
    let imageUrls = [];

    if (files.images) {
      const imageFiles = Array.isArray(files.images)
        ? files.images
        : [files.images];

      for (const file of imageFiles) {
        const fileMetadata = {
          name: file.originalFilename,
          parents: [process.env.DRIVE_FOLDER_ID],
        };

        const media = {
          mimeType: file.mimetype,
          body: fs.createReadStream(file.filepath),
        };

        const uploaded = await drive.files.create({
          requestBody: fileMetadata,
          media,
          fields: "id",
        });

        await drive.permissions.create({
          fileId: uploaded.data.id,
          requestBody: {
            role: "reader",
            type: "anyone",
          },
        });

        imageUrls.push(
          `https://drive.google.com/uc?id=${uploaded.data.id}`
        );
      }
    }

    /* =========================
       Prompt（ありもの）
    ========================= */
    const prompt = `
あなたは中古品のプロ鑑定士です。
以下の条件から、現実的で安全な価格査定を行ってください。

【カテゴリ】
${category}

【状態】
${condition}

【年式】
${year}

【付属品】
${accessories}

【販売戦略】
${strategy}

【要件】
- 市場相場を考慮する
- 利益率は現実的に
- 日本円で回答
- 必ず JSON のみで返す

【出力形式】
{
  "price_buy": number,
  "price_sell": number,
  "profit_rate": number,
  "confidence": number,
  "reason": string
}
`.trim();

    /* =========================
       OpenAI Call
    ========================= */
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

    const raw = completion.choices[0].message.content;

    /* =========================
       JSON 抽出（最重要）
    ========================= */
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("AI response does not contain valid JSON");
    }

    const result = JSON.parse(match[0]);

    /* =========================
       Google Sheets 保存
    ========================= */
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: "A1",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          new Date().toISOString(),
          category,
          condition,
          year,
          accessories,
          strategy,
          result.price_buy,
          result.price_sell,
          result.profit_rate,
          result.confidence,
          result.reason,
          imageUrls.join(", ")
        ]],
      },
    });

    /* =========================
       Response
    ========================= */
    return res.status(200).json({
      success: true,
      result,
      images: imageUrls,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Internal Server Error",
      message: err.message,
    });
  }
}



import { google } from "googleapis";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* ===== Google Sheets ===== */
const auth = new google.auth.JWT(
  process.env.GOOGLE_CLIENT_EMAIL,
  null,
  process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  ["https://www.googleapis.com/auth/spreadsheets"]
);

const sheets = google.sheets({ version: "v4", auth });

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = "シート1";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const payload = JSON.parse(req.body.prompt);

    /* ===== AI計算 ===== */
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "あなたは中古品の価格査定AIです。必ずJSONで返してください。",
        },
        {
          role: "user",
          content: `
以下の商品を査定してください。

${JSON.stringify(payload, null, 2)}

出力形式：
{
  "buyPrice": number,
  "sellPrice": number,
  "profitRate": number,
  "reason": string
}
`,
        },
      ],
      temperature: 0.3,
    });

    const aiResult = JSON.parse(
      completion.choices[0].message.content
    );

    /* ===== Sheets書き込み ===== */
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          new Date().toISOString(),
          payload.category,
          payload.brand,
          payload.model,
          payload.condition,
          payload.year,
          payload.accessories,
          payload.strategy,
          aiResult.buyPrice,
          aiResult.sellPrice,
          aiResult.profitRate,
          aiResult.reason
        ]],
      },
    });

    /* ===== フロントへ返す ===== */
    return res.status(200).json({
      buyPrice: aiResult.buyPrice,
      sellPrice: aiResult.sellPrice,
      profitRate: aiResult.profitRate,
      reason: aiResult.reason,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "AI処理に失敗しました" });
  }
}


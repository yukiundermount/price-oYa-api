import OpenAI from "openai";
import { google } from "googleapis";

export const config = {
  runtime: "nodejs",
};

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const {
      category,
      condition,
      year,
      accessories,
      strategy,
    } = req.body;

    const prompt = `
あなたは中古品のプロ鑑定士です。
以下の条件から現実的な査定を行ってください。

カテゴリ: ${category}
状態: ${condition}
年式: ${year}
付属品: ${accessories}
販売戦略: ${strategy}

必ず JSON のみで返してください。

{
  "price_buy": number,
  "price_sell": number,
  "profit_rate": number,
  "confidence": number,
  "reason": string
}
`;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    });

    const raw = completion.choices[0].message.content;
    const json = JSON.parse(raw.match(/\{[\s\S]*\}/)[0]);

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
          json.price_buy,
          json.price_sell,
          json.profit_rate,
          json.confidence,
          json.reason,
        ]],
      },
    });

    return res.status(200).json({ success: true, result: json });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Internal Server Error",
      message: err.message,
    });
  }
}


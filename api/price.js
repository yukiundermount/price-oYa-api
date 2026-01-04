import { google } from "googleapis";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ===== Google Sheets =====
async function writeToSheet(row) {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GCP_SERVICE_ACCOUNT),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: "シート1!A1",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [row],
    },
  });
}

export default async function handler(req, res) {
  // ===== CORS =====
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      category,
      brand,
      model,
      condition,
      year,
      accessories,
      strategy,
    } = req.body;

    // ===== AIプロンプト =====
    const prompt = `
あなたは日本の高級中古品マーケットに精通したプロの査定士です。

以下の商品情報から、
1. 買取目安価格（円）
2. 推奨販売価格（円）
3. 想定利益率（%）
4. 判断理由（日本語で具体的に）

を算出してください。

【商品情報】
カテゴリ: ${category}
ブランド: ${brand}
モデル: ${model}
状態: ${condition}
年: ${year}
付属品: ${accessories}
販売戦略: ${strategy}

【重要条件】
- ロレックス、デイトナ等の高級時計は市場相場を反映すること
- 極端に安い価格は禁止
- 数値は現実的な中古市場価格
- JSON形式で返すこと
`;

    const aiRes = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
    });

    const result = JSON.parse(aiRes.choices[0].message.content);

    const timestamp = new Date().toISOString();

    // ===== シート書き込み =====
    await writeToSheet([
      timestamp,
      category,
      brand,
      model,
      condition,
      year,
      accessories,
      strategy,
      result.buyPrice,
      result.sellPrice,
      result.profitRate,
      result.reason,
    ]);

    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "AI査定に失敗しました" });
  }
}


const { google } = require("googleapis");
const OpenAI = require("openai");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    /* =====================
       リクエスト取得
    ===================== */
    const {
      category,
      brand,
      model,
      condition,
      year,
      accessories,
      strategy,
      imageCount = 0,
    } = req.body || {};

    /* =====================
       OpenAI
    ===================== */
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `
あなたは日本の中古・新品リセール市場に精通したプロの査定AIです。

【商品情報】
カテゴリ: ${category}
ブランド: ${brand}
モデル: ${model}
状態: ${condition}
年式: ${year}
付属品: ${accessories}
販売戦略: ${strategy}
画像枚数: ${imageCount}

【戦略定義】
- quick_sell: 早く売る（相場下限）
- balance: 相場中央値
- high_price: 高値狙い

【必ずJSONで出力】
{
  "price_buy": number,
  "price_sell": number,
  "profit_margin": number,
  "confidence": number,
  "reasoning": string
}
`;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: "あなたは中古品価格査定の専門家です。" },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
    });

    const result = JSON.parse(completion.choices[0].message.content);

    /* =====================
       Google Sheets
    ===================== */
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SPREADSHEET_ID,
      range: "Sheet1!A1",
      valueInputOption: "USER_ENTERED",
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
          imageCount,
          result.price_buy,
          result.price_sell,
          result.profit_margin,
          result.confidence,
          result.reasoning,
        ]],
      },
    });

    return res.status(200).json({ result });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Internal Server Error",
      message: err.message,
    });
  }
};

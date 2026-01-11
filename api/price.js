import type { VercelRequest, VercelResponse } from "vercel";
import { google } from "googleapis";
import OpenAI from "openai";

export const config = {
  runtime: "nodejs",
};

/* =========================
   Google Sheets 認証
========================= */
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

/* =========================
   OpenAI
========================= */
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/* =========================
   ハンドラ
========================= */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
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
      images = [],
      imageCount = 0,
    } = req.body;

    /* =========================
       AIプロンプト（ここが本体）
    ========================= */
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

【販売戦略の意味】
- quick_sell: 早期売却を優先し、相場下限寄り
- balance: 相場中央値を意識
- high_price: 時間がかかっても高値狙い

【出力ルール】
- 数値はすべて日本円
- 市場相場・希少性・需要を考慮
- 現実的な価格のみ出す

【JSON形式で必ず出力】
{
  "price_buy": number,        // 買取目安価格
  "price_sell": number,       // 推奨販売価格
  "profit_margin": number,    // 利益率（%）
  "confidence": number,       // 査定信頼度（0-100）
  "reasoning": string         // 日本語での判断理由
}
`;

    /* =========================
       OpenAI 呼び出し
    ========================= */
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "あなたは中古品価格査定の専門家です。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.4,
    });

    const text = completion.choices[0].message.content || "{}";
    const result = JSON.parse(text);

    /* =========================
       Google Sheets 書き込み
    ========================= */
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SPREADSHEET_ID!,
      range: "Sheet1!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
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
          ],
        ],
      },
    });

    /* =========================
       レスポンス
    ========================= */
    return res.status(200).json({
      result,
    });
  } catch (error: any) {
    console.error("API Error:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: error.message,
    });
  }
}


import type { VercelRequest, VercelResponse } from "@vercel/node";
import { google } from "googleapis";

/**
 * =========================
 * Google Sheets 設定
 * =========================
 */
const SPREADSHEET_ID = process.env.SPREADSHEET_ID!;
const SHEET_NAME = "Sheet1";

/**
 * サービスアカウント認証
 */
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

/**
 * =========================
 * API Handler
 * =========================
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  /**
   * CORS（OPTIONS対策）
   */
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body ?? {};

    /**
     * =========================
     * 入力値取得（安全）
     * =========================
     */
    const category = body.category ?? "";
    const brand = body.brand ?? "";
    const model = body.model ?? "";
    const condition = body.condition ?? "";
    const year = body.year ?? "";
    const accessories = body.accessories ?? "";
    const strategy = body.strategy ?? "";

    /**
     * =========================
     * 画像処理（重要）
     * =========================
     * base64画像は保存しない
     * → 論理名のみ Sheets に残す
     */
    const images: string[] = Array.isArray(body.images) ? body.images : [];

    const imageCount: number = images.length;

    const imageUrls: string =
      imageCount > 0
        ? images.map((_, i) => `uploaded_image_${i + 1}`).join(",")
        : "";

    /**
     * =========================
     * AI査定（仮ロジック）
     * ※ 既存ロジックを壊さない
     * =========================
     */
    const price_buy = 1200000;
    const price_sell = 1500000;

    const profitRate =
      price_sell > 0
        ? Number(((price_sell - price_buy) / price_sell).toFixed(4))
        : 0;

    const confidence = 0.9;

    const reason =
      "2015年製のロレックスデイトナは人気が高く、状態が新しいため、相場中央値を下回る価格での販売が可能。付属品が揃っていることも価値を高めている。";

    /**
     * =========================
     * Google Sheets 書き込み
     * =========================
     */
    const timestamp = new Date().toISOString();

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:N`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            timestamp,     // A timestamp
            category,      // B category
            brand,         // C brand
            model,         // D model
            condition,     // E condition
            year,          // F year
            accessories,   // G accessories
            strategy,      // H strategy
            imageUrls,     // I imageUrls
            imageCount,    // J imageCount
            price_buy,     // K buyPrice
            price_sell,    // L sellPrice
            profitRate,    // M profitRate
            reason,        // N reason
          ],
        ],
      },
    });

    /**
     * =========================
     * フロント返却
     * =========================
     */
    return res.status(200).json({
      result: {
        price_buy,
        price_sell,
        profit_margin: profitRate,
        confidence,
        reasoning: reason,
      },
    });
  } catch (error) {
    console.error("API ERROR:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}


// lib/writeSheet.ts
import { google } from "googleapis";

type RowInput = {
  timestamp: string;
  category: string;
  brand: string;
  model: string;
  condition: string;
  year: string | number;
  accessories: string;
  strategy: string;
  imageUrls: string[];
  imageCount: number;
  buyPrice: number;
  sellPrice: number;
  profitRate: number;
  reason: string;
};

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function parseServiceAccountJSON() {
  const raw = mustEnv("GOOGLE_SERVICE_ACCOUNT_JSON");
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON. Vercelの環境変数に貼る際に改行やダブルクォートが壊れている可能性があります。"
    );
  }
}

function createAuth() {
  const sa = parseServiceAccountJSON();

  const clientEmail = sa.client_email;
  const privateKey = sa.private_key;

  if (!clientEmail || !privateKey) {
    throw new Error("Service account JSON must include client_email and private_key.");
  }

  const scopes = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
  ];

  const subject = process.env.GOOGLE_IMPERSONATE_USER; // B方式で重要
  if (!subject) {
    // B方式にしないなら subject無しでも動く（Sheets共有で書ける）
    return new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes,
    });
  }

  // Domain-wide delegation (OAuth delegation)
  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes,
    subject,
  });
}

/**
 * シートへ1行追記（列順固定）
 * 想定ヘッダ:
 * timestamp, category, brand, model, condition, year, accessories, strategy, imageUrls, imageCount, buyPrice, sellPrice, profitRate, reason
 */
export async function writeSheetRow(row: RowInput) {
  const auth = createAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const spreadsheetId = mustEnv("SPREADSHEET_ID");
  const sheetName = process.env.SHEET_NAME || "Sheet1";

  const values = [
    [
      row.timestamp,
      row.category,
      row.brand,
      row.model,
      row.condition,
      String(row.year ?? ""),
      row.accessories,
      row.strategy,
      (row.imageUrls || []).join(","), // 1セルにまとめる（必要なら後で分割）
      Number(row.imageCount || 0),
      Number(row.buyPrice || 0),
      Number(row.sellPrice || 0),
      Number(row.profitRate || 0), // 0.25
      row.reason || "",
    ],
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:N`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });
}


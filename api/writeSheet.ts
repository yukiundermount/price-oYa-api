import { google } from "googleapis";

function getEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function writeSheet(payload) {
  const SPREADSHEET_ID = getEnv("SPREADSHEET_ID");
  const CLIENT_EMAIL = getEnv("GOOGLE_CLIENT_EMAIL");
  const PRIVATE_KEY = getEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");
  const SHEET_NAME = process.env.SHEET_NAME || "Sheet1";

  const auth = new google.auth.JWT({
    email: CLIENT_EMAIL,
    key: PRIVATE_KEY,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  const nowIso = new Date().toISOString();

  // あなたのSheetのヘッダ（スクショの順）に合わせて固定
  // A:timestamp B:category C:brand D:model E:condition F:year G:accessories H:strategy
  // I:imageUrls J:imageCount K:buyPrice L:sellPrice M:profitRate N:reason
  const row = [
    nowIso,
    payload.category ?? "",
    payload.brand ?? "",
    payload.model ?? "",
    payload.condition ?? "",
    payload.year ?? "",
    payload.accessories ?? "",
    payload.strategy ?? "",
    payload.imageUrls ?? "",
    Number.isFinite(payload.imageCount) ? payload.imageCount : (payload.imageCount ?? ""),
    payload.buyPrice ?? "",
    payload.sellPrice ?? "",
    payload.profitRate ?? "",
    payload.reason ?? "",
  ];

  const range = `${SHEET_NAME}!A:N`;

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [row],
    },
  });

  return { ok: true };
}

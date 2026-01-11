import OpenAI from "openai";
import { writeSheet } from "../lib/writeSheet.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function cors(res) {
  const origin = process.env.ALLOW_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function toNumber(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function clampInt(n, min, max) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

// JSON抽出フォールバック（万一モデルが余計な文字を出しても救う）
function extractJsonObject(text) {
  if (!text) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  const candidate = text.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  cors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Vercelは通常JSONを自動でreq.bodyに入れてくれますが、念のため保険
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    // 入力（Studioから来る想定）
    const category = body?.category ?? "";
    const brand = body?.brand ?? "";
    const model = body?.model ?? "";
    const condition = body?.condition ?? "";
    const year = body?.year ?? "";
    const accessories = body?.accessories ?? "";
    const strategy = body?.strategy ?? "";
    const imageUrls = Array.isArray(body?.imageUrls) ? body.imageUrls : [];
    const imageCount = clampInt(toNumber(body?.imageCount ?? imageUrls.length) ?? 0, 0, 3);

    if (!category) {
      return res.status(400).json({ error: "category is required" });
    }

    const systemPrompt = `
あなたは「中古品の買取・販売価格」を推定する査定AIです。
入力された商品情報から、以下のJSONだけを返してください（文章は不要）。

【重要ルール】
- 返答は必ずJSON（コードブロック禁止、前後に文字を付けない）
- 数値はすべて整数（円）または小数（profitRate）
- buyPrice < sellPrice を原則（例外時はreasonに注意書き）
- profitRate は (sellPrice - buyPrice) / buyPrice （原価利益率）
- reason は日本語で、根拠を短く明確に（相場・ブランド力・年式/状態・付属品・戦略・画像有無）
- confidence は 0〜100 の整数

【出力JSONスキーマ】
{
  "buyPrice": 120000,
  "sellPrice": 150000,
  "profitRate": 0.25,
  "confidence": 85,
  "reason": "..."
}
`.trim();

    const userPrompt = `
【商品情報】
category: ${category}
brand: ${brand}
model: ${model}
condition: ${condition}
year: ${year}
accessories: ${accessories}
strategy: ${strategy}
imageCount: ${imageCount}
imageUrls: ${imageUrls.slice(0, 3).join(", ")}
`.trim();

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    // 可能なら「JSONスキーマ強制」を使って、必ずJSONだけ返させます
    let parsed = null;
    let rawText = "";

    try {
      const completion = await openai.chat.completions.create({
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "pricing",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                buyPrice: { type: "integer", minimum: 0 },
                sellPrice: { type: "integer", minimum: 0 },
                profitRate: { type: "number" },
                confidence: { type: "integer", minimum: 0, maximum: 100 },
                reason: { type: "string" },
              },
              required: ["buyPrice", "sellPrice", "profitRate", "confidence", "reason"],
            },
          },
        },
      });

      rawText = completion?.choices?.[0]?.message?.content || "";
      parsed = JSON.parse(rawText); // strictなので基本ここでOK
    } catch (e) {
      // response_format非対応モデル等の保険：JSONのみ返すように再要求
      const completion2 = await openai.chat.completions.create({
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt + "\n\nJSONのみで返して。前後に一切の文字を付けない。" },
        ],
      });

      rawText = completion2?.choices?.[0]?.message?.content || "";
      parsed = extractJsonObject(rawText);
    }

    if (!parsed) {
      return res.status(500).json({
        error: "AI pricing failed",
        detail: "AI response is not valid JSON",
        raw: rawText?.slice(0, 500),
      });
    }

    // 正規化
    const buyPrice = clampInt(toNumber(parsed.buyPrice) ?? 0, 0, 999999999);
    const sellPrice = clampInt(toNumber(parsed.sellPrice) ?? 0, 0, 999999999);

    // profitRateは原価利益率で再計算（NaN防止）
    const profitRate =
      buyPrice > 0 ? Number(((sellPrice - buyPrice) / buyPrice).toFixed(4)) : 0;

    const confidence = clampInt(toNumber(parsed.confidence) ?? 50, 0, 100);
    const reason = String(parsed.reason ?? "").trim() || "根拠情報が不足しています。";

    const result = {
      category,
      brand,
      model,
      condition,
      year,
      accessories,
      strategy,
      imageUrls,
      imageCount,
      buyPrice,
      sellPrice,
      profitRate,
      confidence,
      reason,
    };

    // Sheetsへ書き込み（失敗してもAPIは結果を返す）
    try {
      await writeSheet({
        category,
        brand,
        model,
        condition,
        year,
        accessories,
        strategy,
        imageUrls,
        imageCount,
        buyPrice,
        sellPrice,
        profitRate,
        reason,
      });
    } catch (sheetErr) {
      console.error("writeSheet failed:", sheetErr);
    }

    // Studio側が欲しい形（resultが必須っぽいので必ず入れる）
    return res.status(200).json({ result });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error", detail: String(err?.message ?? err) });
  }
}



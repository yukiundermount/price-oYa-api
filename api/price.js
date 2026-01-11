// api/price.js
import { writeSheetRow } from "../lib/writeSheet.ts";

const OPENAI_MODEL_DEFAULT = "gpt-4o-mini";

/**
 * CORS
 */
function setCors(res) {
  const origin = process.env.ALLOW_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

/**
 * Safe number parsing
 */
function toNumber(v, fallback = 0) {
  if (v === null || v === undefined) return fallback;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

function calcProfitRate(buyPrice, sellPrice) {
  const b = toNumber(buyPrice, 0);
  const s = toNumber(sellPrice, 0);
  if (b <= 0 || s <= 0) return 0;
  return (s - b) / b; // 例: 0.25 (=25%)
}

function buildFallbackReason(input, buyPrice, sellPrice, profitRate, confidence) {
  const parts = [];
  if (input.category) parts.push(`カテゴリ: ${input.category}`);
  if (input.brand) parts.push(`ブランド: ${input.brand}`);
  if (input.model) parts.push(`モデル: ${input.model}`);
  if (input.condition) parts.push(`状態: ${input.condition}`);
  if (input.year) parts.push(`年式: ${input.year}`);
  if (input.accessories) parts.push(`付属品: ${input.accessories}`);
  if (input.strategy) parts.push(`販売戦略: ${input.strategy}`);

  parts.push(`買取目安: ${Math.round(buyPrice).toLocaleString()}円`);
  parts.push(`販売目安: ${Math.round(sellPrice).toLocaleString()}円`);
  parts.push(`利益率: ${(profitRate * 100).toFixed(1)}%`);
  parts.push(`信頼度: ${Math.round(confidence)}%`);

  return parts.join(" / ");
}

/**
 * OpenAI call: force JSON output
 */
async function estimateByOpenAI(input) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || OPENAI_MODEL_DEFAULT;

  if (!apiKey) {
    // OpenAI無しでも最低限動くように（開発・デバッグ用）
    return {
      buyPrice: 300000,
      sellPrice: 450000,
      confidence: 50,
      reason: "OPENAI_API_KEY が未設定のため、仮の価格を返しました。",
    };
  }

  const prompt = `
あなたは中古品のプロ査定員です。以下の入力から、
(1) 買取目安価格 buyPrice（円）
(2) 推奨販売価格 sellPrice（円）
(3) 信頼度 confidence（0-100）
(4) 判断理由 reason（日本語で200〜400文字。市場要因・状態/付属品・戦略の反映）
を推定してください。

必ず次のJSONのみを返してください（コードブロック禁止）:
{"buyPrice":123,"sellPrice":456,"confidence":78,"reason":"..."}
`;

  const userContent = {
    category: input.category || "",
    brand: input.brand || "",
    model: input.model || "",
    condition: input.condition || "",
    year: input.year || "",
    accessories: input.accessories || "",
    strategy: input.strategy || "",
    imageUrls: Array.isArray(input.imageUrls) ? input.imageUrls : [],
    imageCount: toNumber(input.imageCount, 0),
  };

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: "You are a professional appraiser." },
        { role: "user", content: prompt + "\n\n入力:\n" + JSON.stringify(userContent) },
      ],
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`OpenAI error: ${resp.status} ${t}`);
  }

  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content ?? "";

  // JSONパース（失敗してもfallbackへ）
  try {
    const obj = JSON.parse(text);
    return {
      buyPrice: toNumber(obj.buyPrice, 0),
      sellPrice: toNumber(obj.sellPrice, 0),
      confidence: toNumber(obj.confidence, 50),
      reason: typeof obj.reason === "string" ? obj.reason : "",
    };
  } catch {
    // “余計な文章が混じった” パターンの救済
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        const obj = JSON.parse(m[0]);
        return {
          buyPrice: toNumber(obj.buyPrice, 0),
          sellPrice: toNumber(obj.sellPrice, 0),
          confidence: toNumber(obj.confidence, 50),
          reason: typeof obj.reason === "string" ? obj.reason : "",
        };
      } catch {
        // fallthrough
      }
    }
    return {
      buyPrice: 0,
      sellPrice: 0,
      confidence: 50,
      reason: "",
    };
  }
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const input = req.body || {};

    // 入力（STUDIOから送られる想定）
    const category = input.category || "";
    const brand = input.brand || "";
    const model = input.model || "";
    const condition = input.condition || "";
    const year = input.year || "";
    const accessories = input.accessories || "";
    const strategy = input.strategy || "";

    const imageUrls = Array.isArray(input.imageUrls) ? input.imageUrls : [];
    const imageCount = toNumber(input.imageCount, imageUrls.length);

    // 1) OpenAI 推定
    const ai = await estimateByOpenAI({
      category,
      brand,
      model,
      condition,
      year,
      accessories,
      strategy,
      imageUrls,
      imageCount,
    });

    // 2) 正規化 + 利益率を確実に作る
    const buyPrice = toNumber(ai.buyPrice, 0);
    const sellPrice = toNumber(ai.sellPrice, 0);
    const profitRate = calcProfitRate(buyPrice, sellPrice);
    const confidence = toNumber(ai.confidence, 50);

    const reason =
      (ai.reason && ai.reason.trim()) ||
      buildFallbackReason(
        { category, brand, model, condition, year, accessories, strategy },
        buyPrice,
        sellPrice,
        profitRate,
        confidence
      );

    // 3) シートに書く（列順固定）
    await writeSheetRow({
      timestamp: new Date().toISOString(),
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
      profitRate, // 0.25 みたいな値
      reason,
    });

    // 4) STUDIO表示向けレスポンス
    return res.status(200).json({
      buyPrice,
      sellPrice,
      profitRate, // 0.25
      profitRatePercent: Number((profitRate * 100).toFixed(1)), // 25.0
      confidence,
      reason,
      imageUrls,
      imageCount,
    });
  } catch (err) {
    return res.status(500).json({
      error: "Internal Server Error",
      message: err?.message || String(err),
    });
  }
}

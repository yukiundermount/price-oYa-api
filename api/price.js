import OpenAI from "openai";
import { writeSheet } from "../lib/writeSheet.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function setCors(res) {
  const allowOrigin = process.env.ALLOW_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}

function safeJsonParse(text) {
  // 1) まずは素直に JSON.parse
  try {
    return JSON.parse(text);
  } catch (_) {}

  // 2) 返答に前後の文字が混ざるケースに備えて、最初の { と最後の } を抜く
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) {
    const sliced = text.slice(first, last + 1);
    try {
      return JSON.parse(sliced);
    } catch (_) {}
  }

  // 3) それでもダメならエラー
  throw new Error("AI response is not valid JSON");
}

function normalizeBody(req) {
  // Next/Vercel環境では req.body が object のことも string のこともあるため吸収
  if (!req.body) return {};
  if (typeof req.body === "string") {
    return JSON.parse(req.body);
  }
  return req.body;
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
    const body = normalizeBody(req);

    const {
      category,
      brand,
      model,
      condition,
      year,
      accessories,
      strategy,
      imageUrls = [],
      imageCount = 0,
    } = body;

    // 入力の最低限チェック
    if (!category) {
      return res.status(400).json({ error: "category is required" });
    }

    // 戦略の正規化（UI側の日本語/英語揺れを吸収）
    const strategyNorm = (() => {
      const s = (strategy || "").toString().trim();
      if (s === "quick_sell" || s.includes("早") || s.includes("早く")) return "quick_sell";
      if (s === "high_price" || s.includes("高") || s.includes("高く")) return "high_price";
      return "balance";
    })();

    // 画像URLはシートに入れやすい形に（配列→文字列）
    const imageUrlsStr = Array.isArray(imageUrls) ? imageUrls.join(",") : String(imageUrls || "");

    const modelName = process.env.OPENAI_MODEL || "gpt-4.1-mini";

    // ===== AIプロンプト（価格ロジックをAI判断）=====
    const system = `
あなたは中古品リセールのプロ査定士です。
入力情報から「推奨販売価格（sellPrice）」と「買取目安価格（buyPrice）」を算出してください。

必須要件:
- 出力は「JSONのみ」。前後に一切の文章やコードフェンスを付けない。
- 数値はすべて整数（円）。カンマ無し。
- profitRate は (sellPrice - buyPrice) / buyPrice を小数で返す（例: 0.25）。
- confidence は 0〜100 の整数。
- reason は日本語で、判断根拠・前提・リスクを短く具体的に。
- 画像が無い/少ない場合は confidence を下げ、reason に不確実性を明記。
- strategy に応じて価格を調整:
  - quick_sell: 売値を相場の下寄せ、買取も安全寄り（回転優先）
  - balance: 標準
  - high_price: 売値を上寄せ、ただし売れるまで時間が掛かる注意も書く
`.trim();

    const user = `
【入力】
category: ${category}
brand: ${brand || ""}
model: ${model || ""}
condition: ${condition || ""}
year: ${year || ""}
accessories: ${accessories || ""}
strategy: ${strategyNorm}
imageCount: ${Number(imageCount) || 0}
imageUrls: ${imageUrlsStr}

【出力JSONの形（このキー名で固定）】
{
  "buyPrice": 0,
  "sellPrice": 0,
  "profitRate": 0,
  "confidence": 0,
  "reason": ""
}
`.trim();

    // OpenAIへ。JSON “だけ”返す強制（可能な限り）
    const ai = await openai.chat.completions.create({
      model: modelName,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      // これが効く環境では JSON強制がかなり安定します（未対応でも無視されるだけ）
      response_format: { type: "json_object" },
    });

    const content = ai?.choices?.[0]?.message?.content ?? "";
    const parsed = safeJsonParse(content);

    // 値の正規化（型崩れ対策）
    const buyPrice = Math.max(0, Math.round(Number(parsed.buyPrice || 0)));
    const sellPrice = Math.max(0, Math.round(Number(parsed.sellPrice || 0)));
    const profitRate =
      buyPrice > 0 ? Number(((sellPrice - buyPrice) / buyPrice).toFixed(4)) : 0;

    const confidence = Math.max(0, Math.min(100, Math.round(Number(parsed.confidence || 0))));
    const reason = (parsed.reason || "").toString();

    const result = {
      category,
      brand: brand || "",
      model: model || "",
      condition: condition || "",
      year: year || "",
      accessories: accessories || "",
      strategy: strategyNorm,
      imageUrls: imageUrlsStr,
      imageCount: Number(imageCount) || 0,
      buyPrice,
      sellPrice,
      profitRate,
      confidence,
      reason,
    };

    // シート追記（失敗してもAPI自体は返したいなら try/catch を分けるが、まずは原因を潰すためここは落とす）
    await writeSheet(result);

    return res.status(200).json(result);
  } catch (err) {
    const msg = err?.message ? String(err.message) : String(err);
    return res.status(500).json({
      error: "AI pricing failed",
      detail: msg,
    });
  }
}


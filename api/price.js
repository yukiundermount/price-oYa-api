import OpenAI from "openai";
import { writeSheet } from "./writeSheet.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// CORSヘルパー
function setCors(res) {
  // いったん全許可（運用で絞るなら STUDIO のドメインに限定）
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

export default async function handler(req, res) {
  setCors(res);

  // Preflight
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ status: "error", message: "Method not allowed" });
  }

  try {
    const { category, brand, model, condition, year, accessories, strategy } =
      req.body || {};

    const systemPrompt = `
あなたは日本の中古・新品市場に精通したプロ鑑定士AIです。
現実的で市場から乖離しない価格を算出してください。
confidence は 0〜1 の小数で返してください。
出力は JSON のみで返してください（コードブロック禁止）。
`;

    const userPrompt = `
あなたは日本のリユース市場・中古相場に精通したプロの鑑定士です。
以下の商品情報と、提供されている場合は商品画像を総合的に判断し、
「実際の中古市場で成立しやすい現実的な価格」を算出してください。

【重要な評価ルール】
- 相場とかけ離れた価格は出さない
- 利益率は (販売価格 - 仕入価格) / 販売価格
- profitRate / confidence は 0〜1 の小数
- 不明点が多い場合は confidence を下げる

【商品情報】
カテゴリ: ${category}
ブランド: ${brand}
モデル: ${model}
状態: ${condition}
年: ${year}
付属品: ${accessories}
販売戦略: ${strategy}

【画像について】
- images が存在する場合、それらは実物の商品画像です
- 状態、傷、使用感、真贋リスク、付属品の有無を必ず確認してください
- 画像が無い場合はテキスト情報のみで判断してください

【販売戦略の考慮】
- quick_sell: 相場下限寄り
- balance: 相場中央値
- high_price: 相場上限寄り

【出力形式（JSONのみ）】
{
  "buyPrice": number,
  "sellPrice": number,
  "profitRate": number,
  "confidence": number,
  "reason": string,
  "warnings": string[]
}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const content = completion.choices?.[0]?.message?.content || "{}";
    const aiResult = JSON.parse(content);

    // Sheets書き込み（失敗しても査定結果は返すようにしたいなら try/catch で囲む）
    await writeSheet({
      category,
      brand,
      model,
      condition,
      year,
      accessories,
      strategy,
      imageInfo, // ← これを渡す
      buyPrice: aiResult.buyPrice,
      sellPrice: aiResult.sellPrice,
      profitRate: aiResult.profitRate,
      reason: aiResult.reason,
    });

    return res.status(200).json({
      status: "ok",
      result: {
        price_buy: aiResult.buyPrice,
        price_sell: aiResult.sellPrice,
        profit_margin: (aiResult.profitRate || 0), // 0.10 = 10%
        confidence: aiResult.confidence, // 0〜1
        reasoning: aiResult.reason,
        warnings: aiResult.warnings || [],
      },
    });
  } catch (err) {
    console.error("price error:", err);
    return res.status(500).json({
      status: "error",
      message: "査定に失敗しました",
    });
  }
}

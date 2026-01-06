import OpenAI from "openai";
import { writeSheet } from "./writeSheet.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// CORSヘルパー
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

// 画像配列を正規化（DataURL or https URL だけ通す）
function normalizeImages(images) {
  if (!Array.isArray(images)) return [];
  return images
    .filter((v) => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => v.startsWith("data:image/") || v.startsWith("http"));
}

export default async function handler(req, res) {
  setCors(res);

  // Preflight
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "Method not allowed" });
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
      images, // ← Studio から受け取る
    } = req.body || {};

    const imageList = normalizeImages(images);
    const imageCount = imageList.length;
    const imageUrls = imageCount ? imageList.join("\n") : "";

    // Studio表示・Sheet記録用（未定義を排除）
    const imageInfo = {
      imageUrls,
      imageCount,
    };

    const systemPrompt = `
あなたは日本の中古・新品市場に精通したプロ鑑定士AIです。
現実的で市場から乖離しない価格を算出してください。
画像がある場合は「真贋リスク」「状態（傷・使用感）」「付属品の整合性」を必ず見て反映してください。
confidence は 0〜1 の小数で返してください。
profitRate は (販売価格 - 仕入価格) / 販売価格 の 0〜1 小数です。
出力は JSON のみ（コードブロック禁止）。
`;

    const userText = `
以下の商品情報と、提供されている場合は商品画像を総合的に判断し、
「実際の中古市場で成立しやすい現実的な価格」を算出してください。

【重要な評価ルール】
- 相場とかけ離れた価格は出さない
- 利益率は (販売価格 - 仕入価格) / 販売価格
- profitRate / confidence は 0〜1 の小数
- 不明点が多い場合は confidence を下げる
- 真贋に不安があれば warnings に明確に入れる

【商品情報】
カテゴリ: ${category}
ブランド: ${brand}
モデル: ${model}
状態: ${condition}
年: ${year}
付属品: ${accessories}
販売戦略: ${strategy}

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

    // Vision推論：テキスト＋画像（最大3枚推奨）
    const content = [{ type: "text", text: userText }];
    for (const url of imageList.slice(0, 3)) {
      content.push({ type: "image_url", image_url: { url } });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content || "{}";

    let aiResult;
    try {
      aiResult = JSON.parse(raw);
    } catch {
      // JSON崩れ救済（Studioを止めない）
      aiResult = {
        buyPrice: 0,
        sellPrice: 0,
        profitRate: 0,
        confidence: 0,
        reason: "AI出力がJSONとして解析できませんでした。",
        warnings: ["MODEL_OUTPUT_NOT_JSON"],
      };
    }

    // Sheets書き込み：失敗してもStudio表示は止めない（重要）
    try {
      await writeSheet({
        category,
        brand,
        model,
        condition,
        year,
        accessories,
        strategy,
        imageUrls: imageInfo.imageUrls,
        imageCount: imageInfo.imageCount,
        buyPrice: aiResult.buyPrice,
        sellPrice: aiResult.sellPrice,
        profitRate: aiResult.profitRate,
        reason: aiResult.reason,
      });
    } catch (e) {
      console.error("sheet write failed:", e);
      // 失敗は warnings にだけ載せる（Studioは成功扱いで返す）
      aiResult.warnings = Array.isArray(aiResult.warnings) ? aiResult.warnings : [];
      aiResult.warnings.push("SHEET_WRITE_FAILED");
    }

    return res.status(200).json({
      status: "ok",
      result: {
        price_buy: aiResult.buyPrice,
        price_sell: aiResult.sellPrice,
        profit_margin: aiResult.profitRate || 0, // 0.10 = 10%
        confidence: aiResult.confidence || 0,
        reasoning: aiResult.reason || "",
        warnings: aiResult.warnings || [],
        imageCount: imageInfo.imageCount,
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

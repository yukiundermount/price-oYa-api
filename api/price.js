import OpenAI from "openai";
import writeSheet from "./writeSheet";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
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
      strategy
    } = req.body;

    const systemPrompt = `
あなたは中古・新品商品のプロ鑑定士AIです。
日本国内の二次流通市場を前提に、現実的な価格を算出してください。
confidence は 0〜1 の小数で返してください。
出力は JSON のみ。
`;

    const userPrompt = `
以下の商品を査定してください。

カテゴリ：${category}
ブランド：${brand}
モデル：${model}
状態：${condition}
年：${year}
付属品：${accessories}
販売戦略：${strategy}

出力形式：
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
        { role: "user", content: userPrompt }
      ]
    });

    const aiResult = JSON.parse(completion.choices[0].message.content);

    // Sheet 書き込み（await必須）
    await writeSheet({
      category,
      brand,
      model,
      condition,
      year,
      accessories,
      strategy,
      buyPrice: aiResult.buyPrice,
      sellPrice: aiResult.sellPrice,
      profitRate: aiResult.profitRate,
      reason: aiResult.reason
    });

    return res.status(200).json({
      status: "ok",
      result: {
        price_buy: aiResult.buyPrice,
        price_sell: aiResult.sellPrice,
        profit_margin: aiResult.profitRate / 100,
        confidence: aiResult.confidence,
        reasoning: aiResult.reason,
        warnings: aiResult.warnings || []
      }
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: "error", message: "査定に失敗しました" });
  }
}

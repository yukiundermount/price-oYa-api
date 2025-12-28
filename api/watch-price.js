import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      category,   // watch | bag | sneaker
      brand,
      model,
      condition,
      year,
      accessories,
      strategy,
    } = req.body;

    /* ===============================
       カテゴリ別プロンプト
    =============================== */

    let systemPrompt = "";
    let userPrompt = "";

    if (category === "watch") {
      systemPrompt = "あなたは高級腕時計専門の中古査定AIです。";

      userPrompt = `
以下の腕時計を査定してください。

ブランド: ${brand}
モデル: ${model}
状態: ${condition}
製造年: ${year}
付属品: ${accessories}
販売戦略: ${strategy}

日本国内中古市場を前提に、
・想定仕入価格
・推奨販売価格
・利益率（%）
・判断理由（日本語・詳細）

を必ずJSON形式のみで出力してください。
`;
    }

    if (category === "bag") {
      systemPrompt = "あなたはブランドバッグ専門のリセール査定AIです。";

      userPrompt = `
以下のブランドバッグを査定してください。

ブランド: ${brand}
モデル: ${model}
状態: ${condition}
購入時期: ${year}
付属品: ${accessories}
販売戦略: ${strategy}

日本の中古ブランドバッグ市場を前提に、
・想定仕入価格
・推奨販売価格
・利益率（%）
・判断理由（日本語・詳細）

を必ずJSON形式のみで出力してください。
`;
    }

    if (category === "sneaker") {
      systemPrompt = "あなたはスニーカー二次流通市場に精通した査定AIです。";

      userPrompt = `
以下のスニーカーを査定してください。

ブランド: ${brand}
モデル: ${model}
状態: ${condition}
発売年: ${year}
付属品: ${accessories}
販売戦略: ${strategy}

StockX・SNKRDUNK等の相場感を考慮し、
・想定仕入価格
・推奨販売価格
・利益率（%）
・判断理由（日本語・詳細）

を必ずJSON形式のみで出力してください。
`;
    }

    /* ===============================
       OpenAI 呼び出し
    =============================== */

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
    });

    const text = completion.choices[0].message.content;

    /* ===============================
       JSON安全パース
    =============================== */

    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}") + 1;
    const jsonString = text.slice(jsonStart, jsonEnd);

    const result = JSON.parse(jsonString);

    return res.status(200).json({
      buyPrice: result.buyPrice,
      sellPrice: result.sellPrice,
      profitRate: result.profitRate,
      reason: result.reason,
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "AI査定に失敗しました",
      detail: error.message,
    });
  }
}



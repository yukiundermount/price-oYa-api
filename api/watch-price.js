export default async function handler(req, res) {

  /* =========================
     CORS / OPTIONS 対応
  ========================= */
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      brand,
      model,
      condition,
      year,
      accessories,
      strategy,
    } = req.body;

    /* =========================
       簡易ロジック（仮）
       ※ 後でAIに置換可能
    ========================= */
    const buyPrice = 850000;
    const sellPrice = 1050000;
    const profitRate = Math.round(
      ((sellPrice - buyPrice) / sellPrice) * 100
    );

    const reason = `
${brand} ${model} は国内中古市場において安定した需要があり、
特に ${year} 年製・状態「${condition}」・付属品「${accessories}」付き個体は
流通数が限られ、価格下落リスクが低いモデルと判断できます。

販売戦略として「${strategy}」を選択しているため、
短期回転と利益率のバランスを重視し、
推奨販売価格を ${sellPrice.toLocaleString()} 円としました。
`.trim();

    return res.status(200).json({
      buyPrice,
      sellPrice,
      profitRate,
      reason,
    });

  } catch (err) {
    return res.status(500).json({
      error: "Internal Server Error",
      detail: err.message,
    });
  }
}



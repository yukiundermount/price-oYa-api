export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    brand,
    model,
    condition,
    year,
    accessories,
    strategy
  } = req.body;

  // 仮ロジック（後でAIに差し替え可）
  const buyPrice = 850000;
  const sellPrice = 1050000;
  const profitRate = Math.round(((sellPrice - buyPrice) / sellPrice) * 100);

  const reason = `
${brand} ${model} は現在も国内外で需要が非常に高いモデルです。
特に ${year} 年製・${condition}・${accessories} 付きの個体は流通量が限られており、
価格の下落リスクが低いと判断できます。

販売戦略として「${strategy}」を選択しているため、
短期回転と利益率のバランスを考慮し、
推奨販売価格を ${sellPrice.toLocaleString()} 円としました。
`.trim();

  return res.status(200).json({
    buyPrice,
    sellPrice,
    profitRate,
    reason
  });
}


export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // OPTIONS（プリフライト）はそのまま許可
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // ★ GET の場合、クエリから取得
  const email = req.query.user_email || "no-email";
  const company = req.query.company || "no-company";

  // ここで実際の AI 処理（例として JSON を返す）
  return res.status(200).json({
    message: "OK",
    received_email: email,
    received_company: company,
  });
}


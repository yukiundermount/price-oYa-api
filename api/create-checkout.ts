import Stripe from "stripe";
import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * 1. Stripe 初期化（安全チェック付き）
 */
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not defined");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // 2. Method check
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 3. Body validation
    const { priceId, email } = req.body;

    if (!priceId || !email) {
      return res.status(400).json({
        error: "priceId と email は必須です",
      });
    }

    // 4. success / cancel URL（環境変数優先）
    const successUrl =
      process.env.SUCCESS_URL ??
      "https://ai-zangyo-free.com/enterprise-ask-1?paid=1";

    const cancelUrl =
      process.env.CANCEL_URL ??
      "https://ai-zangyo-free.com/non-login";

    if (!successUrl || !cancelUrl) {
      return res.status(500).json({
        error: "success_url / cancel_url が未設定です",
      });
    }

    // 5. Checkout Session 作成
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    // 6. 正常レスポンス
    return res.status(200).json({
      checkoutUrl: session.url,
    });
  } catch (err: any) {
    // 7. ログを詳細に残す（Vercel Logs 用）
    console.error("create-checkout error:", {
      message: err?.message,
      type: err?.type,
      raw: err,
    });

    return res.status(500).json({
      error: err?.message ?? "checkout error",
    });
  }
}

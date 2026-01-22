import Stripe from "stripe";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { priceId, email } = req.body;

    if (!priceId || !email) {
      return res.status(400).json({
        error: "priceId と email が必要です",
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: "https://ai-zangyo-free.com/enterprise-ask-1?paid=1",
      cancel_url: "https://ai-zangyo-free.com/non-login",
    });

    return res.status(200).json({
      checkoutUrl: session.url,
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({
      error: err.message ?? "checkout error",
    });
  }
}

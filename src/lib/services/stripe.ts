import Stripe from "stripe";

let stripeClient: Stripe | null = null;

function stripeSecretKey(): string {
  return process.env.STRIPE_SECRET_KEY || "";
}

function stripeWebhookSecret(): string {
  return process.env.STRIPE_WEBHOOK_SECRET || "";
}

export function isStripeConfigured(): boolean {
  return Boolean(stripeSecretKey()) && Boolean(process.env.STRIPE_PRICE_ID);
}

export function getStripe(): Stripe {
  if (!isStripeConfigured()) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(stripeSecretKey(), {
      apiVersion: "2026-01-28.clover",
      typescript: true,
    });
  }

  return stripeClient;
}

export function verifyStripeEvent(payload: Buffer, signature: string): Stripe.Event {
  const stripe = getStripe();
  const secret = stripeWebhookSecret();
  if (!secret) {
    throw new Error("Missing STRIPE_WEBHOOK_SECRET.");
  }

  return stripe.webhooks.constructEvent(payload, signature, secret);
}

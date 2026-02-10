import { describe, expect, test } from "vitest";
import Stripe from "stripe";
import { verifyStripeEvent } from "@/lib/services/stripe";

describe("verifyStripeEvent", () => {
  test("verifies Stripe webhook signature", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
    process.env.STRIPE_PRICE_ID = "price_test_123";

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-01-28.clover",
    });

    const payload = JSON.stringify({
      id: "evt_123",
      object: "event",
      type: "checkout.session.completed",
      data: { object: { id: "cs_123", object: "checkout.session" } },
    });

    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: process.env.STRIPE_WEBHOOK_SECRET,
    });

    const event = verifyStripeEvent(Buffer.from(payload), signature);

    expect(event.type).toBe("checkout.session.completed");
  });
});

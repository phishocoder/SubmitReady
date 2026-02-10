import { DocumentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getStripe } from "@/lib/services/stripe";

const checkoutSchema = z.object({
  token: z.string().min(10),
  email: z.string().email(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = checkoutSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const document = await prisma.document.findUnique({
      where: { publicToken: parsed.data.token },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    if (!document.vendor || !document.date || !document.totalCents) {
      return NextResponse.json(
        {
          error:
            "We need vendor, date, and total before checkout. Please confirm fields first.",
        },
        { status: 400 },
      );
    }

    if (document.status === DocumentStatus.PAID && document.downloadToken) {
      return NextResponse.json({ alreadyPaid: true, downloadToken: document.downloadToken });
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: parsed.data.email,
      line_items: [
        {
          price: env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `${env.APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.APP_URL}/preview/${document.publicToken}`,
      metadata: {
        documentId: document.id,
        documentToken: document.publicToken,
      },
      payment_intent_data: {
        metadata: {
          documentId: document.id,
          documentToken: document.publicToken,
        },
      },
    });

    await prisma.document.update({
      where: { id: document.id },
      data: {
        email: parsed.data.email,
        checkoutSessionId: session.id,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[checkout_session_error]", error);
    return NextResponse.json({ error: "Unable to create checkout session." }, { status: 500 });
  }
}

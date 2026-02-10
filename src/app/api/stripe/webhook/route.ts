import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { sendDownloadEmail } from "@/lib/services/email";
import { verifyStripeEvent } from "@/lib/services/stripe";
import { randomToken } from "@/lib/token";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe signature." }, { status: 400 });
  }

  try {
    const body = Buffer.from(await request.arrayBuffer());
    const event = verifyStripeEvent(body, signature);

    if (event.type !== "checkout.session.completed") {
      return NextResponse.json({ received: true });
    }

    const session = event.data.object;
    const documentId = session.metadata?.documentId;

    if (!documentId) {
      return NextResponse.json({ error: "Missing document metadata." }, { status: 400 });
    }

    const downloadToken = randomToken(24);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const updated = await prisma.document.update({
      where: { id: documentId },
      data: {
        status: "PAID",
        paidAt: new Date(),
        downloadToken,
        downloadTokenExpiresAt: expiresAt,
        checkoutPaymentIntentId:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id,
      },
    });

    if (updated.email) {
      const downloadUrl = `${env.APP_URL}/download/${downloadToken}`;
      await sendDownloadEmail({
        to: updated.email,
        downloadUrl,
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[stripe_webhook_error]", error);
    return NextResponse.json({ error: "Webhook handling failed." }, { status: 400 });
  }
}

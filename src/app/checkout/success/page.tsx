import Link from "next/link";
import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/services/stripe";

type PageProps = {
  searchParams: Promise<{ session_id?: string }>;
};

export default async function CheckoutSuccessPage({ searchParams }: PageProps) {
  const { session_id: sessionId } = await searchParams;

  if (!sessionId) {
    return (
      <main className="mx-auto max-w-xl px-6 py-20">
        <h1 className="text-2xl font-semibold">Missing checkout session</h1>
      </main>
    );
  }

  let downloadToken: string | null = null;

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const document = await prisma.document.findUnique({
      where: { checkoutSessionId: session.id },
    });

    if (document?.status === "PAID" && document.downloadToken) {
      downloadToken = document.downloadToken;
    }
  } catch {
    downloadToken = null;
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-20">
      <div className="mx-auto max-w-xl rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Payment received</h1>
        <p className="mt-3 text-zinc-700">
          We are finalizing your file. If the download button does not appear yet, refresh in a few
          seconds while the webhook completes.
        </p>

        {downloadToken ? (
          <Link
            className="mt-6 inline-flex rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
            href={`/download/${downloadToken}`}
          >
            Download your PDF
          </Link>
        ) : (
          <p className="mt-6 text-sm text-zinc-600">Webhook still processing...</p>
        )}
      </div>
    </main>
  );
}

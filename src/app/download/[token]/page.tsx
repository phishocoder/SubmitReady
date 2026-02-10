import Link from "next/link";
import { prisma } from "@/lib/db";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function DownloadPage({
  params,
}: PageProps) {
    const { token } = await params;
  const document = await prisma.document.findFirst({
    where: {
      downloadToken: token,
      status: "PAID",
      downloadTokenExpiresAt: {
        gt: new Date(),
      },
    },
  });

  if (!document) {
    return (
      <main className="min-h-screen bg-zinc-50 px-6 py-20">
        <div className="mx-auto max-w-xl rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-zinc-900">Link expired or invalid</h1>
          <p className="mt-3 text-zinc-700">Please return to your checkout confirmation page.</p>
          <Link href="/" className="mt-6 inline-flex text-sm text-zinc-800 underline">
            Go to home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-20">
      <div className="mx-auto max-w-xl rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Download your PDF</h1>
        <p className="mt-3 text-zinc-700">
          Your payment is confirmed. This link expires at {document.downloadTokenExpiresAt?.toUTCString()}.
        </p>
        <a
          href={`/api/download/${token}`}
          className="mt-6 inline-flex rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
        >
          Download reimbursement PDF
        </a>
      </div>
    </main>
  );
}

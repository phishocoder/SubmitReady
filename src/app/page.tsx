import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-20">
      <div className="mx-auto max-w-3xl rounded-xl border border-zinc-200 bg-white p-10 shadow-sm">
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900">
          Turn a receipt into a reimbursement-ready PDF.
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-zinc-700">
          Upload one receipt, review extracted details, and preview your output before payment.
          SubmitReady prepares a clean reimbursement document only. No filing, no legal advice,
          no tax advice.
        </p>
        <div className="mt-8">
          <Link
            href="/upload"
            className="inline-flex items-center rounded bg-zinc-900 px-5 py-3 text-sm font-medium text-white"
          >
            Upload receipt
          </Link>
        </div>
      </div>
    </main>
  );
}

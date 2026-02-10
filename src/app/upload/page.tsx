import Link from "next/link";
import { UploadForm } from "@/components/upload-form";

export default function UploadPage() {
  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-16">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <Link href="/" className="text-sm text-zinc-600 hover:text-zinc-900">
            Back to home
          </Link>
          <h1 className="mt-3 text-3xl font-semibold text-zinc-900">Upload your receipt</h1>
          <p className="mt-2 text-zinc-700">
            We process one file at a time and show extraction confidence before payment.
          </p>
        </div>
        <UploadForm />
      </div>
    </main>
  );
}

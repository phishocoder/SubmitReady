import { notFound } from "next/navigation";
import { ensureDatabaseReady, prisma } from "@/lib/db";
import { confidenceLabel } from "@/lib/utils";
import { PreviewForm } from "@/components/preview-form";

type PageProps = {
  params: Promise<{ token: string }>;
};

function formatTotal(totalCents: number | null): string {
  if (totalCents === null) {
    return "";
  }
  return (totalCents / 100).toFixed(2);
}

export default async function PreviewPage({
  params,
}: PageProps) {
  await ensureDatabaseReady();
  const { token } = await params;

  const document = await prisma.document.findUnique({
    where: { publicToken: token },
  });

  if (!document) {
    notFound();
  }

  const canEditVendor = (document.vendorConfidence ?? 0) < 0.75;
  const canEditDate = (document.dateConfidence ?? 0) < 0.75;
  const canEditTotal = (document.totalConfidence ?? 0) < 0.75;

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-12">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-5">
        <section className="space-y-4 lg:col-span-2">
          <h1 className="text-2xl font-semibold text-zinc-900">Review before payment</h1>
          <p className="text-sm text-zinc-700">
            Fields can only be edited when OCR confidence is low.
          </p>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm">
            <p className="font-medium text-zinc-900">OCR confidence</p>
            <ul className="mt-2 space-y-1 text-zinc-700">
              <li>
                Vendor: {confidenceLabel(document.vendorConfidence)} ({Math.round((document.vendorConfidence ?? 0) * 100)}%)
              </li>
              <li>
                Date: {confidenceLabel(document.dateConfidence)} ({Math.round((document.dateConfidence ?? 0) * 100)}%)
              </li>
              <li>
                Total: {confidenceLabel(document.totalConfidence)} ({Math.round((document.totalConfidence ?? 0) * 100)}%)
              </li>
            </ul>
          </div>

          <PreviewForm
            token={token}
            initialVendor={document.vendor ?? ""}
            initialDate={document.date ?? ""}
            initialTotal={formatTotal(document.totalCents)}
            initialEmail={document.email ?? ""}
            canEditVendor={canEditVendor}
            canEditDate={canEditDate}
            canEditTotal={canEditTotal}
          />
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm lg:col-span-3">
          <iframe
            title="PDF preview"
            src={`/api/documents/${token}/preview.pdf`}
            className="h-[760px] w-full rounded border border-zinc-200"
          />
        </section>
      </div>
    </main>
  );
}

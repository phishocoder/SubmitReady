import { NextResponse } from "next/server";
import { ensureDatabaseReady, prisma } from "@/lib/db";
import { generateReimbursementPdf } from "@/lib/services/pdf";
import { getStorage } from "@/lib/services/storage";

type RouteParams = {
  params: Promise<{ token: string }>;
};

export async function GET(
  _request: Request,
  { params }: RouteParams,
) {
  await ensureDatabaseReady();
  const { token } = await params;

  const document = await prisma.document.findUnique({
    where: { publicToken: token },
  });

  if (!document || !document.vendor || !document.date || !document.totalCents) {
    return NextResponse.json({ error: "Document not ready for preview." }, { status: 404 });
  }

  try {
    const storage = getStorage();
    const attachmentImage = await storage.read({ key: document.attachmentImageKey });

    const pdf = await generateReimbursementPdf({
      vendor: document.vendor,
      date: document.date,
      totalCents: document.totalCents,
      currency: document.currency,
      category: document.category,
      receiptBuffer: attachmentImage,
      receiptMimeType: document.attachmentImageMimeType,
      watermarkPreview: document.status !== "PAID",
    });

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[preview_pdf_error]", error);
    return NextResponse.json({ error: "Unable to generate preview PDF." }, { status: 500 });
  }
}

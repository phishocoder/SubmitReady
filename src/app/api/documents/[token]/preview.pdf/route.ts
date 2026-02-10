import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateReimbursementPdf } from "@/lib/services/pdf";
import { getStorage } from "@/lib/services/storage";

type RouteParams = {
  params: Promise<{ token: string }>;
};

export async function GET(
  _request: Request,
  { params }: RouteParams,
) {
  const { token } = await params;

  const document = await prisma.document.findUnique({
    where: { publicToken: token },
  });

  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  try {
    const storage = getStorage();
    const attachmentImage = await storage.read({ key: document.attachmentImageKey });

    const pdf = await generateReimbursementPdf({
      vendor: document.vendor || "Pending confirmation",
      date: document.date || "1970-01-01",
      totalCents: document.totalCents ?? 0,
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

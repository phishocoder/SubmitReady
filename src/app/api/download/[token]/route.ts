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

  const document = await prisma.document.findFirst({
    where: {
      downloadToken: token,
      status: "PAID",
      downloadTokenExpiresAt: {
        gt: new Date(),
      },
    },
  });

  if (!document || !document.vendor || !document.date || !document.totalCents) {
    return NextResponse.json({ error: "Invalid or expired download link." }, { status: 404 });
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
      watermarkPreview: false,
    });

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="submitready-${document.id}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[download_pdf_error]", error);
    return NextResponse.json({ error: "Unable to generate download PDF." }, { status: 500 });
  }
}

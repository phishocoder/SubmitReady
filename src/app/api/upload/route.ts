import { DocumentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { extractReceiptData } from "@/lib/services/extraction";
import { determineStatus } from "@/lib/services/document";
import { getStorage } from "@/lib/services/storage";
import { randomToken } from "@/lib/token";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

export async function POST(request: Request) {
    try {
    const formData = await request.formData();
    const file = formData.get("receipt");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Receipt file is required." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type. Use JPG, PNG, HEIC, or PDF." },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File exceeds the 10MB upload limit." },
        { status: 400 },
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const publicToken = randomToken(18);
    const storage = getStorage();

    const originalExt = file.type === "application/pdf" ? "pdf" : "bin";
    const originalKey = `receipts/${publicToken}/original.${originalExt}`;

    const storedOriginal = await storage.put({
      key: originalKey,
      body: fileBuffer,
      contentType: file.type,
    });

    const extraction = await extractReceiptData(fileBuffer, file.type);

    const attachmentKey = `receipts/${publicToken}/attachment.png`;
    const storedAttachment = await storage.put({
      key: attachmentKey,
      body: extraction.attachmentImage,
      contentType: extraction.attachmentMimeType,
    });

    console.info("[extraction]", {
      token: publicToken,
      overallConfidence: extraction.overallConfidence,
      confidence: extraction.confidence,
      requiresReview: extraction.requiresReview,
    });

    const status = determineStatus({
      vendor: extraction.fields.vendor,
      date: extraction.fields.date,
      totalCents: extraction.fields.totalCents,
      vendorConfidence: extraction.confidence.vendor,
      dateConfidence: extraction.confidence.date,
      totalConfidence: extraction.confidence.total,
    });

    const document = await prisma.document.create({
      data: {
        publicToken,
        receiptKey: storedOriginal.key,
        receiptMimeType: file.type,
        attachmentImageKey: storedAttachment.key,
        attachmentImageMimeType: extraction.attachmentMimeType,
        vendor: extraction.fields.vendor,
        date: extraction.fields.date,
        totalCents: extraction.fields.totalCents,
        currency: extraction.fields.currency,
        category: extraction.fields.category,
        vendorConfidence: extraction.confidence.vendor,
        dateConfidence: extraction.confidence.date,
        totalConfidence: extraction.confidence.total,
        extractionRaw: extraction.rawText,
        status,
      },
    });

    if (status === DocumentStatus.UPLOADED) {
      await prisma.document.update({
        where: { id: document.id },
        data: { status: DocumentStatus.NEEDS_REVIEW },
      });
    }

    return NextResponse.json({ token: publicToken }, { status: 200 });
  } catch (error) {
    console.error("[upload_error]", error);
    return NextResponse.json(
      { error: "Failed to process receipt. Please try again." },
      { status: 500 },
    );
  }
}

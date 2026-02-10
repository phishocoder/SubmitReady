import sharp from "sharp";
import { createWorker } from "tesseract.js";
import type { ExtractionResult } from "@/types/document";

const CONFIDENCE_THRESHOLD = 0.75;

export type ExtractionWithAttachment = ExtractionResult & {
  attachmentImage: Buffer;
  attachmentMimeType: "image/png";
};

function normalizeDate(rawDate: string): string | null {
  const trimmed = rawDate.trim();
  const isoLike = trimmed.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoLike) {
    const year = isoLike[1];
    const month = isoLike[2]!.padStart(2, "0");
    const day = isoLike[3]!.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const usLike = trimmed.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (!usLike) {
    return null;
  }

  const month = usLike[1]!.padStart(2, "0");
  const day = usLike[2]!.padStart(2, "0");
  const yearRaw = usLike[3]!;
  const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
  return `${year}-${month}-${day}`;
}

function parseFieldsFromText(text: string, overallConfidence: number): ExtractionResult {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const vendor = lines[0] ?? null;

  const dateCandidate =
    text.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/)?.[1] ??
    text.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/)?.[1] ??
    null;

  const normalizedDate = dateCandidate ? normalizeDate(dateCandidate) : null;

  const currencyMatch = text.match(/\b(USD|EUR|GBP|CAD|AUD)\b/i)?.[1]?.toUpperCase();

  const amountMatches = Array.from(
    text.matchAll(/(?:\$|USD\s*)?(\d{1,4}(?:,\d{3})*(?:\.\d{2}))/gi),
  ).map((m) => Number(m[1]!.replaceAll(",", "")));

  const totalValue = amountMatches.length > 0 ? Math.max(...amountMatches) : null;
  const totalCents = totalValue !== null ? Math.round(totalValue * 100) : null;

  const category =
    text.match(/\b(category|department|expense type)[:\s]+([A-Za-z\s]+)/i)?.[2]?.trim() ??
    null;

  const vendorConfidence = vendor ? Math.min(0.98, overallConfidence) : 0.2;
  const dateConfidence = normalizedDate ? Math.min(0.95, overallConfidence * 0.92) : 0.2;
  const totalConfidence = totalCents ? Math.min(0.97, overallConfidence * 0.9) : 0.2;

  const requiresReview =
    !vendor ||
    !normalizedDate ||
    !totalCents ||
    vendorConfidence < CONFIDENCE_THRESHOLD ||
    dateConfidence < CONFIDENCE_THRESHOLD ||
    totalConfidence < CONFIDENCE_THRESHOLD;

  return {
    fields: {
      vendor,
      date: normalizedDate,
      totalCents,
      currency: currencyMatch || "USD",
      category,
    },
    confidence: {
      vendor: vendorConfidence,
      date: dateConfidence,
      total: totalConfidence,
    },
    rawText: text,
    overallConfidence,
    requiresReview,
  };
}

async function runImageOcr(buffer: Buffer): Promise<{ text: string; confidence: number }> {
  // Vercel serverless bundling can omit Tesseract node worker internals.
  // Fall back to manual confirmation flow in that environment.
  if (process.env.VERCEL === "1") {
    return { text: "", confidence: 0 };
  }

  const worker = await createWorker("eng");
  try {
    const result = await worker.recognize(buffer);
    const confidence = Math.max(0, Math.min(1, result.data.confidence / 100));
    return { text: result.data.text, confidence };
  } finally {
    await worker.terminate();
  }
}

async function pdfFirstPageToPng(pdfBuffer: Buffer): Promise<Buffer> {
  return sharp(pdfBuffer, { density: 220, page: 0, pages: 1 }).png().toBuffer();
}

async function normalizeImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer).png().toBuffer();
}

export async function extractReceiptData(
  fileBuffer: Buffer,
  mimeType: string,
): Promise<ExtractionWithAttachment> {
  let attachmentImage: Buffer;

  if (mimeType === "application/pdf") {
    attachmentImage = await pdfFirstPageToPng(fileBuffer);
  } else {
    attachmentImage = await normalizeImage(fileBuffer);
  }

  try {
    const ocr = await runImageOcr(attachmentImage);
    const parsed = parseFieldsFromText(ocr.text, ocr.confidence);

    return {
      ...parsed,
      attachmentImage,
      attachmentMimeType: "image/png",
    };
  } catch (error) {
    console.error("[ocr_error]", error);
    return {
      fields: {
        vendor: null,
        date: null,
        totalCents: null,
        currency: "USD",
        category: null,
      },
      confidence: {
        vendor: 0,
        date: 0,
        total: 0,
      },
      rawText: "",
      overallConfidence: 0,
      requiresReview: true,
      attachmentImage,
      attachmentMimeType: "image/png",
    };
  }
}

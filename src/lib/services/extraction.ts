import sharp from "sharp";
import { createWorker } from "tesseract.js";
import type { ExtractionResult } from "@/types/document";

const CONFIDENCE_THRESHOLD = 0.75;
const OCR_TIMEOUT_MS = Number(process.env.OCR_TIMEOUT_MS ?? 20000);
const ENABLE_VERCEL_OCR = process.env.ENABLE_VERCEL_OCR === "1";
const OCR_PROVIDER = (process.env.OCR_PROVIDER ?? "auto").toLowerCase();
const OCR_SPACE_API_KEY = process.env.OCR_SPACE_API_KEY ?? "";
const OCR_SPACE_ENDPOINT = process.env.OCR_SPACE_ENDPOINT ?? "https://api.ocr.space/parse/image";
const OCR_SPACE_MAX_BYTES = Number(process.env.OCR_SPACE_MAX_BYTES ?? 950 * 1024);

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
  const isVercel = process.env.VERCEL === "1";
  const shouldUseOcrSpace =
    OCR_PROVIDER === "ocr_space" || (OCR_PROVIDER === "auto" && isVercel && Boolean(OCR_SPACE_API_KEY));

  if (OCR_PROVIDER === "none") {
    return { text: "", confidence: 0 };
  }

  if (shouldUseOcrSpace) {
    return runOcrSpace(buffer);
  }

  // Tesseract's Node worker bundle is not reliably available in Vercel serverless.
  // Default to manual confirmation path unless explicitly opted in.
  if (isVercel && !ENABLE_VERCEL_OCR) {
    return { text: "", confidence: 0 };
  }

  if (OCR_PROVIDER !== "auto" && OCR_PROVIDER !== "tesseract") {
    return { text: "", confidence: 0 };
  }

  return runTesseract(buffer);
}

async function runTesseract(buffer: Buffer): Promise<{ text: string; confidence: number }> {
  const worker = await createWorker("eng");
  try {
    const result = await Promise.race([
      worker.recognize(buffer),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`OCR timeout after ${OCR_TIMEOUT_MS}ms`)), OCR_TIMEOUT_MS),
      ),
    ]);
    const confidence = Math.max(0, Math.min(1, result.data.confidence / 100));
    return { text: result.data.text, confidence };
  } finally {
    await worker.terminate();
  }
}

async function runOcrSpace(buffer: Buffer): Promise<{ text: string; confidence: number }> {
  if (!OCR_SPACE_API_KEY) {
    return { text: "", confidence: 0 };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);

  try {
    const ocrBuffer = await prepareImageForOcrSpace(buffer);
    const formData = new FormData();
    formData.append("apikey", OCR_SPACE_API_KEY);
    formData.append("language", "eng");
    formData.append("isOverlayRequired", "true");
    formData.append("OCREngine", "2");
    formData.append("file", new Blob([new Uint8Array(ocrBuffer)], { type: "image/jpeg" }), "receipt.jpg");

    const response = await fetch(OCR_SPACE_ENDPOINT, {
      method: "POST",
      body: formData,
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`OCR.space request failed with ${response.status}`);
    }

    const data = await response.json() as {
      IsErroredOnProcessing?: boolean;
      ErrorMessage?: string[] | string;
      ParsedResults?: Array<{
        ParsedText?: string;
        TextOverlay?: {
          Lines?: Array<{
            Words?: Array<{ WordText?: string; Confidence?: number }>;
          }>;
        };
      }>;
    };

    if (data.IsErroredOnProcessing) {
      const message = Array.isArray(data.ErrorMessage)
        ? data.ErrorMessage.join("; ")
        : (data.ErrorMessage ?? "Unknown OCR.space processing error");
      throw new Error(message);
    }

    const parsedText = data.ParsedResults?.[0]?.ParsedText?.trim() ?? "";
    const confidences =
      data.ParsedResults?.[0]?.TextOverlay?.Lines?.flatMap((line) =>
        (line.Words ?? [])
          .map((word) => Number(word.Confidence))
          .filter((value) => Number.isFinite(value) && value >= 0),
      ) ?? [];

    const averageConfidence =
      confidences.length > 0
        ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length / 100
        : parsedText.length > 0
          ? 0.65
          : 0;

    return {
      text: parsedText,
      confidence: Math.max(0, Math.min(1, averageConfidence)),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function prepareImageForOcrSpace(buffer: Buffer): Promise<Buffer> {
  let maxDimension = 2200;
  let quality = 82;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = await sharp(buffer)
      .rotate()
      .resize({
        width: maxDimension,
        height: maxDimension,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    if (candidate.byteLength <= OCR_SPACE_MAX_BYTES) {
      return candidate;
    }

    quality = Math.max(45, quality - 8);
    maxDimension = Math.max(1200, Math.floor(maxDimension * 0.85));
  }

  return sharp(buffer)
    .rotate()
    .resize({
      width: 1200,
      height: 1200,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 42, mozjpeg: true })
    .toBuffer();
}

async function pdfFirstPageToPng(pdfBuffer: Buffer): Promise<Buffer> {
  return sharp(pdfBuffer, { density: 220, page: 0, pages: 1 }).png().toBuffer();
}

async function normalizeImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer).rotate().grayscale().normalize().png().toBuffer();
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

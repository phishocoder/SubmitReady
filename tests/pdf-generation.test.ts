import { describe, expect, test } from "vitest";
import sharp from "sharp";
import { generateReimbursementPdf } from "@/lib/services/pdf";

describe("generateReimbursementPdf", () => {
  test("is deterministic for same inputs", async () => {
    const receipt = await sharp({
      create: {
        width: 600,
        height: 400,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .png()
      .toBuffer();

    const payload = {
      vendor: "Acme Office Supply",
      date: "2026-01-10",
      totalCents: 12345,
      currency: "USD",
      category: "Office",
      receiptBuffer: receipt,
      receiptMimeType: "image/png",
      watermarkPreview: false,
    } as const;

    const first = await generateReimbursementPdf(payload);
    const second = await generateReimbursementPdf(payload);

    expect(Buffer.from(first)).toEqual(Buffer.from(second));
  });
});

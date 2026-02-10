import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import { amountToCurrency } from "@/lib/utils";

type PdfPayload = {
  vendor: string;
  date: string;
  totalCents: number;
  currency: string;
  category?: string | null;
  receiptBuffer: Buffer;
  receiptMimeType: string;
  watermarkPreview?: boolean;
};

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

export async function generateReimbursementPdf(payload: PdfPayload): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const stableDate = new Date("2026-01-01T00:00:00.000Z");
  pdf.setCreationDate(stableDate);
  pdf.setModificationDate(stableDate);
  pdf.setProducer("SubmitReady");
  pdf.setCreator("SubmitReady");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const firstPage = pdf.addPage([612, 792]);
  const { width, height } = firstPage.getSize();

  firstPage.drawRectangle({
    x: 40,
    y: 40,
    width: width - 80,
    height: height - 80,
    borderColor: rgb(0.85, 0.85, 0.85),
    borderWidth: 1,
  });

  firstPage.drawText("Expense Reimbursement Submission", {
    x: 60,
    y: height - 90,
    size: 20,
    font: bold,
    color: rgb(0.12, 0.12, 0.12),
  });

  const tableTop = height - 150;
  const rowHeight = 34;
  const rows = [
    ["Vendor", payload.vendor],
    ["Date", formatDate(payload.date)],
    ["Category", payload.category || "-"],
    ["Currency", payload.currency],
    ["Total", amountToCurrency(payload.totalCents, payload.currency)],
  ] as const;

  firstPage.drawRectangle({
    x: 60,
    y: tableTop - rows.length * rowHeight,
    width: width - 120,
    height: rows.length * rowHeight,
    borderColor: rgb(0.75, 0.75, 0.75),
    borderWidth: 1,
  });

  rows.forEach(([label, value], index) => {
    const y = tableTop - index * rowHeight;
    if (index !== 0) {
      firstPage.drawLine({
        start: { x: 60, y },
        end: { x: width - 60, y },
        color: rgb(0.85, 0.85, 0.85),
        thickness: 1,
      });
    }

    firstPage.drawText(label, {
      x: 74,
      y: y - 22,
      size: 11,
      font: bold,
      color: rgb(0.2, 0.2, 0.2),
    });

    firstPage.drawText(value, {
      x: 220,
      y: y - 22,
      size: 11,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
  });

  const footerY = 120;
  firstPage.drawText(
    "Prepared for standard employer reimbursement submissions. Does not submit on your behalf.",
    {
      x: 60,
      y: footerY,
      size: 9,
      font,
      color: rgb(0.32, 0.32, 0.32),
    },
  );

  firstPage.drawText("Not legal or tax advice.", {
    x: 60,
    y: footerY - 16,
    size: 9,
    font,
    color: rgb(0.32, 0.32, 0.32),
  });

  if (payload.watermarkPreview) {
    firstPage.drawText("PREVIEW - UNPAID", {
      x: 145,
      y: 430,
      size: 42,
      font: bold,
      color: rgb(0.85, 0.15, 0.15),
      opacity: 0.22,
      rotate: degrees(-34),
    });
  }

  const attachmentPage = pdf.addPage([612, 792]);
  attachmentPage.drawText("Attached Receipt", {
    x: 60,
    y: 740,
    size: 18,
    font: bold,
    color: rgb(0.12, 0.12, 0.12),
  });

  const image =
    payload.receiptMimeType === "image/png"
      ? await pdf.embedPng(payload.receiptBuffer)
      : await pdf.embedJpg(payload.receiptBuffer);

  const maxWidth = 490;
  const maxHeight = 620;
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);

  const imageWidth = image.width * scale;
  const imageHeight = image.height * scale;

  attachmentPage.drawImage(image, {
    x: (612 - imageWidth) / 2,
    y: 90,
    width: imageWidth,
    height: imageHeight,
  });

  return pdf.save({ useObjectStreams: false, addDefaultPage: false });
}

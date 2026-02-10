import { DocumentStatus } from "@prisma/client";
import { ensureDatabaseReady, prisma } from "@/lib/db";

const CONFIDENCE_THRESHOLD = 0.75;

export function determineStatus(params: {
  vendor: string | null;
  date: string | null;
  totalCents: number | null;
  vendorConfidence: number | null;
  dateConfidence: number | null;
  totalConfidence: number | null;
}): DocumentStatus {
  const hasAllCoreFields = Boolean(params.vendor && params.date && params.totalCents);

  if (!hasAllCoreFields) {
    return DocumentStatus.NEEDS_REVIEW;
  }

  const allConfident =
    (params.vendorConfidence ?? 0) >= CONFIDENCE_THRESHOLD &&
    (params.dateConfidence ?? 0) >= CONFIDENCE_THRESHOLD &&
    (params.totalConfidence ?? 0) >= CONFIDENCE_THRESHOLD;

  return allConfident ? DocumentStatus.READY : DocumentStatus.NEEDS_REVIEW;
}

export async function getDocumentByToken(token: string) {
  await ensureDatabaseReady();
  return prisma.document.findUnique({ where: { publicToken: token } });
}

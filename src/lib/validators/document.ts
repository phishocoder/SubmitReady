import { z } from "zod";

export const updateDocumentSchema = z.object({
  vendor: z.string().trim().min(1).max(140),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  total: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "Total must be a valid monetary amount"),
});

export function parseTotalToCents(total: string): number {
  return Math.round(Number(total) * 100);
}

export function isValidDateISO(date: string): boolean {
  const timestamp = Date.parse(`${date}T00:00:00.000Z`);
  return !Number.isNaN(timestamp);
}

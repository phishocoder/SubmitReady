export type ExtractedReceiptFields = {
  vendor: string | null;
  date: string | null;
  totalCents: number | null;
  currency: string;
  category: string | null;
};

export type FieldConfidence = {
  vendor: number;
  date: number;
  total: number;
};

export type ExtractionResult = {
  fields: ExtractedReceiptFields;
  confidence: FieldConfidence;
  rawText: string;
  overallConfidence: number;
  requiresReview: boolean;
};

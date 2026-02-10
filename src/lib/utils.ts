export function amountToCurrency(totalCents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(totalCents / 100);
}

export function confidenceLabel(score: number | null | undefined): string {
  if (score === null || score === undefined) {
    return "Unknown";
  }
  if (score >= 0.85) {
    return "High";
  }
  if (score >= 0.7) {
    return "Medium";
  }
  return "Low";
}

export function parseIp(value: string | null): string {
  if (!value) {
    return "unknown";
  }
  return value.split(",")[0]?.trim() || "unknown";
}

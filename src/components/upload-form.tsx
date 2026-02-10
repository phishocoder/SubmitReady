"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function UploadForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const receipt = formData.get("receipt");

    if (!(receipt instanceof File) || receipt.size === 0) {
      setError("Please select a receipt file.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as { token?: string; error?: string };
      if (!response.ok || !data.token) {
        throw new Error(data.error || "Upload failed.");
      }

      router.push(`/preview/${data.token}`);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Upload failed. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <label className="block text-sm font-medium text-zinc-700" htmlFor="receipt">
        Upload receipt (JPG, PNG, HEIC, PDF. Max 10MB)
      </label>
      <input
        id="receipt"
        name="receipt"
        type="file"
        accept="image/jpeg,image/png,image/heic,image/heif,application/pdf"
        className="block w-full rounded border border-zinc-300 px-3 py-2 text-sm"
        required
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {isSubmitting ? "Processing..." : "Upload and preview"}
      </button>
    </form>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  token: string;
  initialVendor: string;
  initialDate: string;
  initialTotal: string;
  initialEmail: string;
  canEditVendor: boolean;
  canEditDate: boolean;
  canEditTotal: boolean;
};

export function PreviewForm(props: Props) {
  const router = useRouter();
  const [vendor, setVendor] = useState(props.initialVendor);
  const [date, setDate] = useState(props.initialDate);
  const [total, setTotal] = useState(props.initialTotal);
  const [email, setEmail] = useState(props.initialEmail);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckout, setIsCheckout] = useState(false);

  const anyEditable = useMemo(
    () => props.canEditVendor || props.canEditDate || props.canEditTotal,
    [props.canEditDate, props.canEditTotal, props.canEditVendor],
  );

  async function saveCorrections() {
    if (!anyEditable) {
      return;
    }

    setIsSaving(true);
    setError(null);

    const response = await fetch(`/api/documents/${props.token}/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendor, date, total }),
    });

    const json = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(json.error || "Could not save corrections.");
    }
  }

  async function onCheckout() {
    setError(null);
    if (!email) {
      setError("Email is required.");
      return;
    }

    try {
      if (anyEditable) {
        await saveCorrections();
      }

      setIsCheckout(true);
      const response = await fetch("/api/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: props.token, email }),
      });

      const json = (await response.json()) as {
        url?: string;
        error?: string;
        alreadyPaid?: boolean;
        downloadToken?: string;
      };

      if (json.alreadyPaid && json.downloadToken) {
        router.push(`/download/${json.downloadToken}`);
        return;
      }

      if (!response.ok || !json.url) {
        throw new Error(json.error || "Unable to start checkout.");
      }

      window.location.assign(json.url);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Checkout failed.");
      setIsCheckout(false);
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="grid gap-3">
        <label className="text-sm font-medium text-zinc-700" htmlFor="vendor">
          Vendor
        </label>
        <input
          id="vendor"
          value={vendor}
          disabled={!props.canEditVendor}
          onChange={(event) => setVendor(event.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
        />

        <label className="text-sm font-medium text-zinc-700" htmlFor="date">
          Date
        </label>
        <input
          id="date"
          type="date"
          value={date}
          disabled={!props.canEditDate}
          onChange={(event) => setDate(event.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
        />

        <label className="text-sm font-medium text-zinc-700" htmlFor="total">
          Total
        </label>
        <input
          id="total"
          value={total}
          disabled={!props.canEditTotal}
          onChange={(event) => setTotal(event.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-100"
        />

        <label className="text-sm font-medium text-zinc-700" htmlFor="email">
          Email for download link
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 text-sm"
          required
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={onCheckout}
        disabled={isCheckout || isSaving}
        className="w-full rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {isCheckout || isSaving ? "Working..." : "Download PDF ($9)"}
      </button>
    </div>
  );
}

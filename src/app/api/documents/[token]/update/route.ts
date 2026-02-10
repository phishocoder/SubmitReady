import { DocumentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { determineStatus } from "@/lib/services/document";
import {
  isValidDateISO,
  parseTotalToCents,
  updateDocumentSchema,
} from "@/lib/validators/document";

type RouteParams = {
  params: Promise<{ token: string }>;
};

export async function POST(request: Request, { params }: RouteParams) {
  const { token } = await params;

  try {
    const body = await request.json();
    const parsed = updateDocumentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    if (!isValidDateISO(parsed.data.date)) {
      return NextResponse.json({ error: "Invalid date." }, { status: 400 });
    }

    const totalCents = parseTotalToCents(parsed.data.total);
    if (totalCents <= 0 || totalCents > 5_000_000) {
      return NextResponse.json(
        { error: "Total must be greater than 0 and below 50,000." },
        { status: 400 },
      );
    }

    const existing = await prisma.document.findUnique({
      where: { publicToken: token },
    });

    if (!existing) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }

    if (existing.status === DocumentStatus.PAID) {
      return NextResponse.json(
        { error: "Paid documents cannot be edited." },
        { status: 400 },
      );
    }

    const status = determineStatus({
      vendor: parsed.data.vendor,
      date: parsed.data.date,
      totalCents,
      vendorConfidence: Math.max(existing.vendorConfidence ?? 0, 0.8),
      dateConfidence: Math.max(existing.dateConfidence ?? 0, 0.8),
      totalConfidence: Math.max(existing.totalConfidence ?? 0, 0.8),
    });

    await prisma.document.update({
      where: { id: existing.id },
      data: {
        vendor: parsed.data.vendor,
        date: parsed.data.date,
        totalCents,
        status,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[document_update_error]", error);
    return NextResponse.json({ error: "Unable to update document." }, { status: 500 });
  }
}

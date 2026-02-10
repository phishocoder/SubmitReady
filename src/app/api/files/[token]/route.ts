import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStorage } from "@/lib/services/storage";

type RouteParams = {
  params: Promise<{ token: string }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  const { token } = await params;
  const document = await prisma.document.findUnique({
    where: { publicToken: token },
  });

  if (!document) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const storage = getStorage();
    const file = await storage.read({ key: document.attachmentImageKey });
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": document.attachmentImageMimeType,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[file_read_error]", error);
    return NextResponse.json({ error: "Unable to load file." }, { status: 500 });
  }
}

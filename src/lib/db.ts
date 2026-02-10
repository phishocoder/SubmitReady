import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { env } from "@/lib/env";

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ??
  new PrismaClient({
    log: ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

function sqliteFilePath(databaseUrl: string): string | null {
  if (!databaseUrl.startsWith("file:")) {
    return null;
  }
  return databaseUrl.slice("file:".length);
}

let initPromise: Promise<void> | null = null;

export async function ensureDatabaseReady(): Promise<void> {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const filePath = sqliteFilePath(env.DATABASE_URL);
    if (!filePath) {
      return;
    }

    const resolvedPath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);

    await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
    await fs.open(resolvedPath, "a").then((file) => file.close());

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Document" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "publicToken" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'UPLOADED',
        "email" TEXT,
        "receiptKey" TEXT NOT NULL,
        "receiptMimeType" TEXT NOT NULL,
        "attachmentImageKey" TEXT NOT NULL,
        "attachmentImageMimeType" TEXT NOT NULL DEFAULT 'image/png',
        "vendor" TEXT,
        "date" TEXT,
        "totalCents" INTEGER,
        "currency" TEXT NOT NULL DEFAULT 'USD',
        "category" TEXT,
        "vendorConfidence" REAL,
        "dateConfidence" REAL,
        "totalConfidence" REAL,
        "extractionRaw" TEXT,
        "checkoutSessionId" TEXT,
        "checkoutPaymentIntentId" TEXT,
        "paidAt" DATETIME,
        "downloadToken" TEXT,
        "downloadTokenExpiresAt" DATETIME,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "Document_publicToken_key" ON "Document"("publicToken");`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "Document_checkoutSessionId_key" ON "Document"("checkoutSessionId");`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "Document_downloadToken_key" ON "Document"("downloadToken");`,
    );
  })();

  return initPromise;
}

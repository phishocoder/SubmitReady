import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { parseIp } from "@/lib/utils";

type RateWindow = {
  count: number;
  resetAt: number;
};

const WINDOW_MS = 60 * 1000;
const MAX_UPLOADS_PER_WINDOW = 10;
const rateStore = new Map<string, RateWindow>();

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname !== "/api/upload") {
    return NextResponse.next();
  }

  const ip = parseIp(request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"));
  const now = Date.now();
  const current = rateStore.get(ip);

  if (!current || current.resetAt < now) {
    rateStore.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return NextResponse.next();
  }

  if (current.count >= MAX_UPLOADS_PER_WINDOW) {
    return NextResponse.json(
      { error: "Too many uploads. Please retry in a minute." },
      { status: 429 },
    );
  }

  current.count += 1;
  rateStore.set(ip, current);

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/upload"],
};

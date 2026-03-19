import { NextRequest, NextResponse } from "next/server";

// Simple in-memory rate limiter (resets on cold start)
const requests = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 15; // 15 requests per minute per IP

function getIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function middleware(req: NextRequest) {
  // Only rate limit API chat/agent endpoints
  const path = req.nextUrl.pathname;
  if (path !== "/api/chat" && path !== "/api/agent") {
    return NextResponse.next();
  }

  const ip = getIP(req);
  const now = Date.now();
  const entry = requests.get(ip);

  if (!entry || now > entry.resetAt) {
    requests.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return NextResponse.next();
  }

  if (entry.count >= MAX_REQUESTS) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Max 15 requests per minute." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((entry.resetAt - now) / 1000)),
        },
      }
    );
  }

  entry.count++;
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/chat", "/api/agent"],
};

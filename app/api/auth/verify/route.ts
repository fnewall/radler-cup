import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth/verify";
import { signSession, setSessionCookie } from "@/lib/auth/session";

// Simple in-memory rate limit by IP. Resets on serverless cold starts,
// which is fine for our scale.
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 10;

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_ATTEMPTS) return false;
  entry.count += 1;
  return true;
}

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (!rateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in a minute." },
      { status: 429 }
    );
  }

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const password = body.password?.trim();
  if (!password) {
    return NextResponse.json({ error: "Password required" }, { status: 400 });
  }

  const result = await verifyPassword(password);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason === "error" ? "Server error" : "Incorrect password" },
      { status: result.reason === "error" ? 500 : 401 }
    );
  }

  const token = await signSession(result.role, result.scope);
  await setSessionCookie(token);

  return NextResponse.json({ role: result.role, scope: result.scope });
}

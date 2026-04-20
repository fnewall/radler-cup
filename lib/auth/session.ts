import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export type SessionRole = "player" | "captain" | "admin";

export type Session = {
  role: SessionRole;
  scope: string | null; // captain: team_id; else null
  iat: number;
};

const COOKIE_NAME = "radler_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET env var is not set");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(
  role: SessionRole,
  scope: string | null
): Promise<string> {
  return await new SignJWT({ role, scope })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());
}

export async function verifySession(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (
      typeof payload.role !== "string" ||
      !["player", "captain", "admin"].includes(payload.role)
    ) {
      return null;
    }
    return {
      role: payload.role as SessionRole,
      scope: (payload.scope as string | null) ?? null,
      iat: (payload.iat as number) ?? 0,
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return await verifySession(token);
}

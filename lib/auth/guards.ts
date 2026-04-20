import { getSession, type Session } from "./session";

/**
 * For API routes: returns session if admin, else null.
 * The caller returns 401/403 as appropriate.
 */
export async function getAdminSession(): Promise<Session | null> {
  const session = await getSession();
  if (!session || session.role !== "admin") return null;
  return session;
}

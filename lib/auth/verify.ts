import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SessionRole } from "./session";

export type VerifyResult =
  | { ok: true; role: SessionRole; scope: string | null }
  | { ok: false; reason: "invalid" | "error" };

export async function verifyPassword(plain: string): Promise<VerifyResult> {
  if (!plain || plain.length < 3 || plain.length > 100) {
    return { ok: false, reason: "invalid" };
  }

  const supabase = createAdminClient();
  const { data: rows, error } = await supabase
    .from("app_password")
    .select("role, scope, password_hash");

  if (error || !rows) {
    console.error("Failed to load passwords:", error);
    return { ok: false, reason: "error" };
  }

  // Check each hash. There are only 4 rows so this is cheap.
  for (const row of rows) {
    const match = await bcrypt.compare(plain, row.password_hash);
    if (match) {
      return {
        ok: true,
        role: row.role as SessionRole,
        scope: row.scope ?? null,
      };
    }
  }

  return { ok: false, reason: "invalid" };
}

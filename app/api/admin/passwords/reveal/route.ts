import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("app_password")
    .select("id, password_plain");

  if (error) {
    console.error("Failed to load password plaintext:", error);
    return NextResponse.json({ error: "Fetch failed" }, { status: 500 });
  }

  const byId: Record<string, string | null> = {};
  for (const row of data ?? []) {
    byId[row.id] = row.password_plain ?? null;
  }

  return NextResponse.json({ passwords: byId });
}

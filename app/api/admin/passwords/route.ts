import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getAdminSession } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

type Body = {
  password_id?: string;
  new_password?: string;
};

export async function PATCH(req: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { password_id, new_password } = body;

  if (!password_id || typeof password_id !== "string") {
    return NextResponse.json({ error: "password_id required" }, { status: 400 });
  }

  if (!new_password || typeof new_password !== "string") {
    return NextResponse.json({ error: "new_password required" }, { status: 400 });
  }

  const trimmed = new_password.trim();
  if (trimmed.length < 4) {
    return NextResponse.json(
      { error: "Password must be at least 4 characters" },
      { status: 400 }
    );
  }
  if (trimmed.length > 100) {
    return NextResponse.json(
      { error: "Password must be 100 characters or fewer" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data: existing, error: fetchErr } = await supabase
    .from("app_password")
    .select("id, role")
    .eq("id", password_id)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: "Password not found" }, { status: 404 });
  }

  const hash = await bcrypt.hash(trimmed, 10);

  const { error } = await supabase
    .from("app_password")
    .update({
      password_hash: hash,
      password_plain: trimmed,
    })
    .eq("id", password_id);

  if (error) {
    console.error("Password update failed:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

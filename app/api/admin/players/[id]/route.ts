import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

type Patch = {
  display_name?: string;
  handicap?: number | null;
  team_id?: string;
};

function validate(body: unknown): Patch | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid body" };
  const b = body as Record<string, unknown>;
  const out: Patch = {};

  if ("display_name" in b) {
    if (typeof b.display_name !== "string") return { error: "display_name must be string" };
    const trimmed = b.display_name.trim();
    if (trimmed.length < 1 || trimmed.length > 80) return { error: "display_name length invalid" };
    out.display_name = trimmed;
  }

  if ("handicap" in b) {
    if (b.handicap === null || b.handicap === "") {
      out.handicap = null;
    } else if (typeof b.handicap === "number" && !Number.isNaN(b.handicap)) {
      if (b.handicap < -5 || b.handicap > 60) return { error: "handicap out of range" };
      out.handicap = b.handicap;
    } else {
      return { error: "handicap must be number or null" };
    }
  }

  if ("team_id" in b) {
    if (typeof b.team_id !== "string" || b.team_id.length < 10) {
      return { error: "team_id invalid" };
    }
    out.team_id = b.team_id;
  }

  if (Object.keys(out).length === 0) return { error: "No fields to update" };
  return out;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const validated = validate(body);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("player")
    .update(validated)
    .eq("id", id)
    .select("id, display_name, handicap, team_id")
    .single();

  if (error || !data) {
    console.error("Player update failed:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json(data);
}

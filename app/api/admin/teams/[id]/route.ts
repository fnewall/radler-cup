import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

type Patch = {
  name?: string;
  display_code?: string;
  colour_primary?: string;
  colour_dark_text?: string;
  colour_bg_tint?: string;
  colour_border?: string;
  captain_player_id?: string | null;
};

const HEX = /^#([0-9A-Fa-f]{6})$/;

function validate(body: unknown): Patch | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid body" };
  const b = body as Record<string, unknown>;
  const out: Patch = {};

  if ("name" in b) {
    if (typeof b.name !== "string") return { error: "name invalid" };
    const t = b.name.trim();
    if (t.length < 1 || t.length > 60) return { error: "name length invalid" };
    out.name = t;
  }

  if ("display_code" in b) {
    if (typeof b.display_code !== "string") return { error: "display_code invalid" };
    const t = b.display_code.trim();
    if (t.length < 1 || t.length > 3) return { error: "display_code must be 1–3 chars" };
    out.display_code = t.toUpperCase();
  }

  for (const k of ["colour_primary", "colour_dark_text", "colour_bg_tint", "colour_border"] as const) {
    if (k in b) {
      if (typeof b[k] !== "string" || !HEX.test(b[k] as string)) {
        return { error: `${k} must be hex (#RRGGBB)` };
      }
      out[k] = b[k] as string;
    }
  }

  if ("captain_player_id" in b) {
    if (b.captain_player_id === null || b.captain_player_id === "") {
      out.captain_player_id = null;
    } else if (typeof b.captain_player_id === "string" && b.captain_player_id.length >= 10) {
      out.captain_player_id = b.captain_player_id;
    } else {
      return { error: "captain_player_id invalid" };
    }
  }

  if (Object.keys(out).length === 0) return { error: "No fields to update" };
  return out;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  // If setting a captain, verify they're on this team
  if (validated.captain_player_id) {
    const { data: player } = await supabase
      .from("player")
      .select("team_id")
      .eq("id", validated.captain_player_id)
      .single();
    if (!player || player.team_id !== id) {
      return NextResponse.json(
        { error: "Captain must be a member of this team" },
        { status: 400 }
      );
    }
  }

  const { data, error } = await supabase
    .from("team")
    .update(validated)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    console.error("Team update failed:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json(data);
}

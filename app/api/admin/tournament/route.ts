import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

type Patch = {
  name?: string;
  start_date?: string | null;
  end_date?: string | null;
  points_to_win?: number;
  points_to_tie?: number;
  tiebreaker_rule?: string | null;
  max_strokes_per_hole?: number | null;
  end_match_early?: boolean;
  concession_enabled?: boolean;
};

function validateDate(v: unknown): string | null | false {
  if (v === null || v === "") return null;
  if (typeof v !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  return v;
}

function validate(body: unknown): Patch | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid body" };
  const b = body as Record<string, unknown>;
  const out: Patch = {};

  if ("name" in b) {
    if (typeof b.name !== "string" || b.name.trim().length < 1 || b.name.length > 100) {
      return { error: "name invalid" };
    }
    out.name = b.name.trim();
  }

  if ("start_date" in b) {
    const r = validateDate(b.start_date);
    if (r === false) return { error: "start_date must be YYYY-MM-DD" };
    out.start_date = r;
  }

  if ("end_date" in b) {
    const r = validateDate(b.end_date);
    if (r === false) return { error: "end_date must be YYYY-MM-DD" };
    out.end_date = r;
  }

  if ("points_to_win" in b) {
    if (typeof b.points_to_win !== "number" || b.points_to_win <= 0 || b.points_to_win > 100) {
      return { error: "points_to_win invalid" };
    }
    out.points_to_win = b.points_to_win;
  }

  if ("points_to_tie" in b) {
    if (typeof b.points_to_tie !== "number" || b.points_to_tie <= 0 || b.points_to_tie > 100) {
      return { error: "points_to_tie invalid" };
    }
    out.points_to_tie = b.points_to_tie;
  }

  if ("tiebreaker_rule" in b) {
    if (b.tiebreaker_rule === null || b.tiebreaker_rule === "") {
      out.tiebreaker_rule = null;
    } else if (typeof b.tiebreaker_rule === "string" && b.tiebreaker_rule.length <= 500) {
      out.tiebreaker_rule = b.tiebreaker_rule.trim();
    } else {
      return { error: "tiebreaker_rule invalid" };
    }
  }

  if ("max_strokes_per_hole" in b) {
    if (b.max_strokes_per_hole === null || b.max_strokes_per_hole === "") {
      out.max_strokes_per_hole = null;
    } else if (
      typeof b.max_strokes_per_hole === "number" &&
      b.max_strokes_per_hole >= 1 &&
      b.max_strokes_per_hole <= 4
    ) {
      out.max_strokes_per_hole = Math.round(b.max_strokes_per_hole);
    } else {
      return { error: "max_strokes_per_hole must be 1–4 or blank" };
    }
  }

  if ("end_match_early" in b) {
    if (typeof b.end_match_early !== "boolean") {
      return { error: "end_match_early must be boolean" };
    }
    out.end_match_early = b.end_match_early;
  }

  if ("concession_enabled" in b) {
    if (typeof b.concession_enabled !== "boolean") {
      return { error: "concession_enabled must be boolean" };
    }
    out.concession_enabled = b.concession_enabled;
  }

  if (Object.keys(out).length === 0) return { error: "No fields to update" };
  return out;
}

export async function PATCH(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  const { data: existing, error: fetchErr } = await supabase
    .from("tournament")
    .select("id")
    .limit(1)
    .single();
  if (fetchErr || !existing) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("tournament")
    .update(validated)
    .eq("id", existing.id)
    .select("*")
    .single();

  if (error || !data) {
    console.error("Tournament update failed:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json(data);
}

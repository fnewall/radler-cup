import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

const FORMATS = ["foursomes", "betterball", "greensomes", "scramble_2v2", "singles"] as const;
type Format = (typeof FORMATS)[number];

type Patch = {
  label?: string;
  start_at?: string | null;
  format?: Format;
  match_count?: number;
  points_per_match?: number;
  tees_used?: string | null;
};

function validate(body: unknown): Patch | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid body" };
  const b = body as Record<string, unknown>;
  const out: Patch = {};

  if ("label" in b) {
    if (typeof b.label !== "string" || b.label.trim().length < 1 || b.label.length > 200) {
      return { error: "label invalid" };
    }
    out.label = b.label.trim();
  }

  if ("start_at" in b) {
    if (b.start_at === null || b.start_at === "") {
      out.start_at = null;
    } else if (typeof b.start_at === "string") {
      const d = new Date(b.start_at);
      if (Number.isNaN(d.getTime())) return { error: "start_at invalid" };
      out.start_at = d.toISOString();
    } else {
      return { error: "start_at invalid" };
    }
  }

  if ("format" in b) {
    if (typeof b.format !== "string" || !FORMATS.includes(b.format as Format)) {
      return { error: "format invalid" };
    }
    out.format = b.format as Format;
  }

  if ("match_count" in b) {
    if (typeof b.match_count !== "number" || b.match_count < 1 || b.match_count > 24) {
      return { error: "match_count invalid" };
    }
    out.match_count = Math.round(b.match_count);
  }

  if ("points_per_match" in b) {
    if (typeof b.points_per_match !== "number" || b.points_per_match <= 0 || b.points_per_match > 10) {
      return { error: "points_per_match invalid" };
    }
    out.points_per_match = b.points_per_match;
  }

  if ("tees_used" in b) {
    if (b.tees_used === null || b.tees_used === "") {
      out.tees_used = null;
    } else if (typeof b.tees_used === "string" && b.tees_used.length <= 50) {
      out.tees_used = b.tees_used;
    } else {
      return { error: "tees_used invalid" };
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
  const { data, error } = await supabase
    .from("session")
    .update(validated)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    console.error("Session update failed:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json(data);
}

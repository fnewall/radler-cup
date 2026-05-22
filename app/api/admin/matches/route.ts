import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

type Action = "reset" | "concede" | "halve" | "reopen";

type Body = {
  action: Action;
  match_id: string;
  winning_team_id?: string;
};

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.action || !body.match_id) {
    return NextResponse.json(
      { error: "action and match_id required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data: match } = await supabase
    .from("match")
    .select(
      "id, session_id, status, winning_team_id, points_team_a, points_team_b"
    )
    .eq("id", body.match_id)
    .single();

  if (!match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  const { data: sessionRow } = await supabase
    .from("session")
    .select("id, points_per_match, tournament_id")
    .eq("id", match.session_id)
    .single();

  if (!sessionRow) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const pointsPerMatch = Number(sessionRow.points_per_match);

  switch (body.action) {
    case "reset": {
      await supabase
        .from("hole_score")
        .delete()
        .eq("match_id", body.match_id);
      await supabase
        .from("match")
        .update({
          status: "pending",
          winning_team_id: null,
          points_team_a: 0,
          points_team_b: 0,
          ended_on_hole: null,
        })
        .eq("id", body.match_id);
      return NextResponse.json({ ok: true });
    }

    case "concede": {
      if (!body.winning_team_id) {
        return NextResponse.json(
          { error: "winning_team_id required" },
          { status: 400 }
        );
      }

      // Verify the team belongs to this tournament
      const { data: teams } = await supabase
        .from("team")
        .select("id, display_order")
        .eq("tournament_id", sessionRow.tournament_id)
        .order("display_order", { ascending: true, nullsFirst: false });
      if (!teams || teams.length < 2) {
        return NextResponse.json(
          { error: "Teams misconfigured" },
          { status: 500 }
        );
      }
      const isA = body.winning_team_id === teams[0].id;
      const isB = body.winning_team_id === teams[1].id;
      if (!isA && !isB) {
        return NextResponse.json(
          { error: "Winning team is not in this tournament" },
          { status: 400 }
        );
      }

      await supabase
        .from("match")
        .update({
          status: "conceded",
          winning_team_id: body.winning_team_id,
          points_team_a: isA ? pointsPerMatch : 0,
          points_team_b: isB ? pointsPerMatch : 0,
        })
        .eq("id", body.match_id);

      return NextResponse.json({ ok: true });
    }

    case "halve": {
      await supabase
        .from("match")
        .update({
          status: "complete_tied",
          winning_team_id: null,
          points_team_a: pointsPerMatch / 2,
          points_team_b: pointsPerMatch / 2,
        })
        .eq("id", body.match_id);
      return NextResponse.json({ ok: true });
    }

    case "reopen": {
      // Look at existing hole_scores: if none → pending; otherwise → in_progress.
      // Clear any forced winner/points; live evaluation will re-derive.
      const { data: scores } = await supabase
        .from("hole_score")
        .select("hole_number")
        .eq("match_id", body.match_id)
        .limit(1);

      const newStatus =
        (scores ?? []).length > 0 ? "in_progress" : "pending";

      await supabase
        .from("match")
        .update({
          status: newStatus,
          winning_team_id: null,
          points_team_a: 0,
          points_team_b: 0,
          ended_on_hole: null,
        })
        .eq("id", body.match_id);

      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}

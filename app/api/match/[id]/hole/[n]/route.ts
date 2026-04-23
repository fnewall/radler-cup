import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeAllowance, type Allowance } from "@/lib/scoring/allowance";
import { strokesPerHole } from "@/lib/scoring/strokes";
import {
  computeHoleResult,
  computeConcededHole,
  type FoursomesInput,
  type BetterballInput,
} from "@/lib/scoring/holeResult";
import { evaluateMatch, type HoleScoreRow, type Format } from "@/lib/scoring/evaluate";

type Body = {
  // For non-betterball formats:
  team_a_gross?: number | null;
  team_b_gross?: number | null;
  // For betterball:
  team_a_p1_gross?: number | null;
  team_a_p2_gross?: number | null;
  team_b_p1_gross?: number | null;
  team_b_p2_gross?: number | null;
  // Conceded to which team?
  concede_to?: "team_a" | "team_b" | null;
  // Client-supplied device id for audit
  device_id?: string;
};

function isNumOrNull(v: unknown): v is number | null {
  return v === null || v === undefined || (typeof v === "number" && !Number.isNaN(v) && v >= 1 && v <= 20);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; n: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { id, n } = await params;
  const holeNumber = parseInt(n, 10);
  if (!holeNumber || holeNumber < 1 || holeNumber > 18) {
    return NextResponse.json({ error: "Invalid hole number" }, { status: 400 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validate numeric fields
  for (const key of [
    "team_a_gross",
    "team_b_gross",
    "team_a_p1_gross",
    "team_a_p2_gross",
    "team_b_p1_gross",
    "team_b_p2_gross",
  ] as const) {
    if (body[key] !== undefined && !isNumOrNull(body[key])) {
      return NextResponse.json({ error: `${key} invalid` }, { status: 400 });
    }
  }

  const concedeTo = body.concede_to ?? null;
  if (concedeTo !== null && concedeTo !== "team_a" && concedeTo !== "team_b") {
    return NextResponse.json({ error: "concede_to invalid" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Load match, session, tournament, course, players, pairings
  const { data: match } = await supabase
    .from("match")
    .select("id, session_id, team_a_pairing_id, team_b_pairing_id, status")
    .eq("id", id)
    .single();
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  const { data: sessionRow } = await supabase
    .from("session")
    .select("id, format, points_per_match, handicap_allowance, tournament_id")
    .eq("id", match.session_id)
    .single();
  if (!sessionRow) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const { data: tournament } = await supabase
    .from("tournament")
    .select("id, max_strokes_per_hole, end_match_early, concession_enabled")
    .eq("id", sessionRow.tournament_id)
    .single();
  if (!tournament) return NextResponse.json({ error: "Tournament not found" }, { status: 404 });

  if (concedeTo !== null && !tournament.concession_enabled) {
    return NextResponse.json({ error: "Concessions disabled" }, { status: 400 });
  }

  const { data: course } = await supabase
    .from("course")
    .select("id")
    .eq("tournament_id", tournament.id)
    .limit(1)
    .single();
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  const { data: holeRows } = await supabase
    .from("hole")
    .select("hole_number, par, stroke_index")
    .eq("course_id", course.id)
    .order("hole_number", { ascending: true });

  const holes = (holeRows ?? []).map((h) => ({
    hole_number: h.hole_number,
    par: h.par,
    stroke_index: h.stroke_index,
  }));
  const thisHole = holes.find((h) => h.hole_number === holeNumber);
  if (!thisHole) return NextResponse.json({ error: "Hole not found" }, { status: 404 });

  // Teams
  const { data: teams } = await supabase
    .from("team")
    .select("id, display_order")
    .eq("tournament_id", tournament.id)
    .order("display_order", { ascending: true, nullsFirst: false });
  if (!teams || teams.length < 2)
    return NextResponse.json({ error: "Teams missing" }, { status: 404 });

  // Players in this match
  const { data: pairingPlayers } = await supabase
    .from("pairing_player")
    .select("pairing_id, player_id, slot")
    .in("pairing_id", [match.team_a_pairing_id, match.team_b_pairing_id]);

  const playerIds = (pairingPlayers ?? []).map((pp) => pp.player_id);
  const { data: playerRows } = await supabase
    .from("player")
    .select("id, handicap")
    .in("id", playerIds);
  const handicapById = new Map(
    (playerRows ?? []).map((p) => [p.id, p.handicap as number | null])
  );

  const teamAPlayers = (pairingPlayers ?? [])
    .filter((pp) => pp.pairing_id === match.team_a_pairing_id)
    .sort((a, b) => a.slot - b.slot);
  const teamBPlayers = (pairingPlayers ?? [])
    .filter((pp) => pp.pairing_id === match.team_b_pairing_id)
    .sort((a, b) => a.slot - b.slot);

  // Allowance
  const allowance = computeAllowance(
    (sessionRow.handicap_allowance as Allowance) ?? null,
    teamAPlayers.map((pp) => ({
      player_id: pp.player_id,
      handicap: handicapById.get(pp.player_id) ?? null,
    })),
    teamBPlayers.map((pp) => ({
      player_id: pp.player_id,
      handicap: handicapById.get(pp.player_id) ?? null,
    }))
  );

  // Per-hole strokes for each player
  const perHoleStrokes: Record<string, Record<number, number>> = {};
  for (const pid of Object.keys(allowance.strokesByPlayer)) {
    perHoleStrokes[pid] = strokesPerHole(
      allowance.strokesByPlayer[pid],
      holes,
      tournament.max_strokes_per_hole
    );
  }

  const playerIdMap = {
    team_a_p1: teamAPlayers[0]?.player_id,
    team_a_p2: teamAPlayers[1]?.player_id,
    team_b_p1: teamBPlayers[0]?.player_id,
    team_b_p2: teamBPlayers[1]?.player_id,
  };

  // Pair-level strokes: the pair receives the strokes allocated to their side
  // (in pair scope, both players have the same value; in individual scope for
  // non-betterball formats like singles, we don't use pair strokes).
  const strokesForHole = (() => {
    if (sessionRow.format === "betterball") {
      const players: Record<string, number> = {};
      for (const pid of Object.keys(perHoleStrokes)) {
        players[pid] = perHoleStrokes[pid][holeNumber] ?? 0;
      }
      return { team_a_players: players, team_b_players: players };
    }
    if (sessionRow.format === "singles") {
      // Singles: each player gets their own strokes applied to the single ball
      const aId = playerIdMap.team_a_p1;
      const bId = playerIdMap.team_b_p1;
      return {
        team_a_pair: aId ? perHoleStrokes[aId]?.[holeNumber] ?? 0 : 0,
        team_b_pair: bId ? perHoleStrokes[bId]?.[holeNumber] ?? 0 : 0,
      };
    }
    // Pair formats: use the weaker-side's pair strokes on this hole
    const aFirst = playerIdMap.team_a_p1;
    const bFirst = playerIdMap.team_b_p1;
    return {
      team_a_pair: aFirst ? perHoleStrokes[aFirst]?.[holeNumber] ?? 0 : 0,
      team_b_pair: bFirst ? perHoleStrokes[bFirst]?.[holeNumber] ?? 0 : 0,
    };
  })();

  const grossInputs = (() => {
    if (sessionRow.format === "betterball") {
      return {
        team_a: {
          p1_gross: body.team_a_p1_gross ?? null,
          p2_gross: body.team_a_p2_gross ?? null,
        },
        team_b: {
          p1_gross: body.team_b_p1_gross ?? null,
          p2_gross: body.team_b_p2_gross ?? null,
        },
      } as BetterballInput;
    }
    return {
      team_a: { gross: body.team_a_gross ?? null },
      team_b: { gross: body.team_b_gross ?? null },
    } as FoursomesInput;
  })();

  // Compute the hole result
  const computation = concedeTo
    ? computeConcededHole(
        sessionRow.format as Format,
        concedeTo,
        thisHole.par,
        grossInputs,
        strokesForHole,
        playerIdMap
      )
    : computeHoleResult(
        sessionRow.format as Format,
        grossInputs,
        strokesForHole,
        playerIdMap
      );

  // Upsert hole_score
  const { error: upsertErr } = await supabase
    .from("hole_score")
    .upsert(
      {
        match_id: match.id,
        hole_number: holeNumber,
        scores: computation.stored_scores,
        result: computation.result,
        entered_by_device_id: body.device_id ?? null,
        edited_at: new Date().toISOString(),
      },
      { onConflict: "match_id,hole_number" }
    );

  if (upsertErr) {
    console.error("hole_score upsert failed:", upsertErr);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }

  // Re-evaluate the whole match and update match row (status, points, ended_on)
  const { data: allScoresRaw } = await supabase
    .from("hole_score")
    .select("hole_number, scores, result")
    .eq("match_id", match.id)
    .order("hole_number", { ascending: true });

  const allScores: HoleScoreRow[] = (allScoresRaw ?? []).map((r) => ({
    hole_number: r.hole_number,
    scores: r.scores as Record<string, unknown>,
    result: r.result as HoleScoreRow["result"],
  }));

  const evaluation = evaluateMatch(
    holes,
    allScores,
    Number(sessionRow.points_per_match),
    tournament.end_match_early
  );

  let newStatus = match.status;
  let winningTeamId: string | null = null;
  if (evaluation.complete) {
    const st = evaluation.status.state;
    if (st === "team_a_wins") {
      newStatus = "complete_decided";
      winningTeamId = teams[0].id;
    } else if (st === "team_b_wins") {
      newStatus = "complete_decided";
      winningTeamId = teams[1].id;
    } else if (st === "halved") {
      newStatus = "complete_tied";
    }
  } else {
    newStatus = "in_progress";
  }

  await supabase
    .from("match")
    .update({
      status: newStatus,
      winning_team_id: winningTeamId,
      points_team_a: evaluation.points.team_a,
      points_team_b: evaluation.points.team_b,
      ended_on_hole: evaluation.ended_on_hole,
    })
    .eq("id", match.id);

  // Also flip the session status as appropriate
  const { data: allMatchesInSession } = await supabase
    .from("match")
    .select("status")
    .eq("session_id", match.session_id);

  const anyInProgress = (allMatchesInSession ?? []).some(
    (m) => m.status === "in_progress"
  );
  const allComplete = (allMatchesInSession ?? []).every((m) =>
    ["complete_decided", "complete_tied", "conceded"].includes(m.status)
  );

  let sessionStatus: "upcoming" | "in_progress" | "complete" = "in_progress";
  if (allComplete) sessionStatus = "complete";
  else if (!anyInProgress) sessionStatus = "in_progress";

  await supabase
    .from("session")
    .update({ status: sessionStatus })
    .eq("id", match.session_id);

  return NextResponse.json({
    ok: true,
    result: computation.result,
    team_a_net: computation.team_a_net,
    team_b_net: computation.team_b_net,
    match_complete: evaluation.complete,
  });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; n: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { id, n } = await params;
  const holeNumber = parseInt(n, 10);

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("hole_score")
    .delete()
    .eq("match_id", id)
    .eq("hole_number", holeNumber);

  if (error) {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }

  // Let the caller refresh to trigger re-evaluation via a follow-up POST
  // or refresh; match totals will refresh on next /match page load.
  return NextResponse.json({ ok: true });
}

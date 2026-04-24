import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  evaluateMatch,
  type HoleScoreRow,
  type MatchStatus,
} from "@/lib/scoring/evaluate";

export type SessionDetail = {
  tournament: {
    id: string;
    name: string;
  };
  session: {
    id: string;
    session_number: number;
    label: string;
    day_number: number;
    format: string;
    match_count: number;
    start_at: string | null;
    pairings_revealed: boolean;
    status: "upcoming" | "in_progress" | "complete";
    tees_used: string | null;
    points_per_match: number;
  };
  teams: Array<{
    id: string;
    name: string;
    display_code: string;
    display_order: number | null;
    colour_primary: string;
  }>;
  submissionStatus: {
    team_a_submitted: boolean;
    team_b_submitted: boolean;
    team_a_id: string | null;
    team_b_id: string | null;
  };
  matches: Array<{
    id: string;
    match_order: number;
    status: string;
    winning_team_id: string | null;
    points_team_a: number;
    points_team_b: number;
    ended_on_hole: number | null;
    team_a: MatchSide;
    team_b: MatchSide;
    // Live-derived
    live_status: MatchStatus;
    provisional_points_team_a: number;
    provisional_points_team_b: number;
    holes_played: number;
    started: boolean;
  }>;
  totals: {
    points_a: number;
    points_b: number;
    any_started: boolean;
  };
};

type MatchSide = {
  team_id: string;
  team_name: string;
  team_display_code: string;
  team_colour: string;
  players: Array<{ id: string; display_name: string; handicap: number | null; slot: number }>;
};

export async function getSessionDetail(
  sessionId: string
): Promise<SessionDetail | null> {
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: session } = await supabase
    .from("session")
    .select("id, session_number, label, day_number, format, match_count, start_at, pairings_revealed, status, tees_used, points_per_match, tournament_id")
    .eq("id", sessionId)
    .single();

  if (!session) return null;

  const { data: tournament } = await supabase
    .from("tournament")
    .select("id, name, end_match_early")
    .eq("id", session.tournament_id)
    .single();

  if (!tournament) return null;

  const { data: teams } = await supabase
    .from("team")
    .select("id, name, display_code, display_order, colour_primary")
    .eq("tournament_id", tournament.id)
    .order("display_order", { ascending: true, nullsFirst: false });

  const teamsArr = teams ?? [];
  const teamAId = teamsArr[0]?.id ?? null;
  const teamBId = teamsArr[1]?.id ?? null;

  const { data: pairings } = await supabase
    .from("pairing")
    .select("id, team_id, match_order, submitted_at")
    .eq("session_id", sessionId);

  const pairingsArr = pairings ?? [];

  function allSubmittedFor(teamId: string | null): boolean {
    if (!teamId) return false;
    const forTeam = pairingsArr.filter((p) => p.team_id === teamId);
    if (forTeam.length === 0) return false;
    return forTeam.every((p) => p.submitted_at !== null);
  }

  const submissionStatus = {
    team_a_submitted: allSubmittedFor(teamAId),
    team_b_submitted: allSubmittedFor(teamBId),
    team_a_id: teamAId,
    team_b_id: teamBId,
  };

  let matches: SessionDetail["matches"] = [];
  let totalPointsA = 0;
  let totalPointsB = 0;
  let anyStarted = false;

  if (session.pairings_revealed && teamAId && teamBId) {
    // Load holes once
    const { data: courseRow } = await admin
      .from("course")
      .select("id")
      .eq("tournament_id", tournament.id)
      .limit(1)
      .single();

    const { data: holeRows } = courseRow
      ? await admin
          .from("hole")
          .select("hole_number, par, stroke_index")
          .eq("course_id", courseRow.id)
          .order("hole_number", { ascending: true })
      : { data: [] };

    const holes = (holeRows ?? []).map((h) => ({
      hole_number: h.hole_number,
      par: h.par,
      stroke_index: h.stroke_index,
    }));

    const { data: matchRows } = await admin
      .from("match")
      .select("id, match_order, status, winning_team_id, points_team_a, points_team_b, ended_on_hole, team_a_pairing_id, team_b_pairing_id")
      .eq("session_id", sessionId)
      .order("match_order", { ascending: true });

    const matchArr = matchRows ?? [];
    const allPairingIds = matchArr.flatMap((m) => [
      m.team_a_pairing_id,
      m.team_b_pairing_id,
    ]);

    const { data: pairingPlayers } = allPairingIds.length
      ? await admin
          .from("pairing_player")
          .select("pairing_id, player_id, slot")
          .in("pairing_id", allPairingIds)
      : { data: [] };

    const playerIds = Array.from(
      new Set((pairingPlayers ?? []).map((pp) => pp.player_id))
    );

    const { data: players } = playerIds.length
      ? await admin
          .from("player")
          .select("id, display_name, handicap, team_id")
          .in("id", playerIds)
      : { data: [] };

    const playerMap = new Map((players ?? []).map((p) => [p.id, p]));

    // Load all hole_scores for matches in this session in one query
    const matchIds = matchArr.map((m) => m.id);
    const { data: allScoreRows } = matchIds.length
      ? await admin
          .from("hole_score")
          .select("match_id, hole_number, scores, result")
          .in("match_id", matchIds)
      : { data: [] };

    const teamA = teamsArr[0];
    const teamB = teamsArr[1];

    matches = matchArr.map((m) => {
      const makeSide = (pairingId: string, team: typeof teamA): MatchSide => {
        const slots = (pairingPlayers ?? [])
          .filter((pp) => pp.pairing_id === pairingId)
          .sort((a, b) => a.slot - b.slot);
        return {
          team_id: team.id,
          team_name: team.name,
          team_display_code: team.display_code,
          team_colour: team.colour_primary,
          players: slots.map((s) => {
            const p = playerMap.get(s.player_id);
            return {
              id: s.player_id,
              display_name: p?.display_name ?? "?",
              handicap: p?.handicap ?? null,
              slot: s.slot,
            };
          }),
        };
      };

      const scoreRows: HoleScoreRow[] = (allScoreRows ?? [])
        .filter((r) => r.match_id === m.id)
        .map((r) => ({
          hole_number: r.hole_number,
          scores: r.scores as Record<string, unknown>,
          result: r.result as HoleScoreRow["result"],
        }));

      const concededToA = m.status === "conceded" && m.winning_team_id === teamA.id;
      const concededToB = m.status === "conceded" && m.winning_team_id === teamB.id;

      const evaluation = evaluateMatch(
        holes,
        scoreRows,
        Number(session.points_per_match),
        tournament.end_match_early,
        concededToA ? "team_a" : concededToB ? "team_b" : null
      );

      const holesPlayed = scoreRows.length;
      const started = holesPlayed > 0 || evaluation.complete || m.status !== "pending";

      // Provisional points:
      //  - If complete: use evaluator's points
      //  - If in progress & leading: leader gets points_per_match, other gets 0
      //  - If in progress & tied: split points_per_match
      //  - If not started: 0 / 0
      let provA = 0;
      let provB = 0;
      if (evaluation.complete) {
        provA = evaluation.points.team_a;
        provB = evaluation.points.team_b;
      } else if (started) {
        switch (evaluation.status.state) {
          case "team_a_up":
            provA = Number(session.points_per_match);
            break;
          case "team_b_up":
            provB = Number(session.points_per_match);
            break;
          case "all_square":
            provA = Number(session.points_per_match) / 2;
            provB = Number(session.points_per_match) / 2;
            break;
        }
      }

      if (started) anyStarted = true;
      totalPointsA += provA;
      totalPointsB += provB;

      return {
        id: m.id,
        match_order: m.match_order,
        status: m.status,
        winning_team_id: m.winning_team_id,
        points_team_a: Number(m.points_team_a),
        points_team_b: Number(m.points_team_b),
        ended_on_hole: m.ended_on_hole,
        team_a: makeSide(m.team_a_pairing_id, teamA),
        team_b: makeSide(m.team_b_pairing_id, teamB),
        live_status: evaluation.status,
        provisional_points_team_a: provA,
        provisional_points_team_b: provB,
        holes_played: holesPlayed,
        started,
      };
    });
  }

  return {
    tournament: { id: tournament.id, name: tournament.name },
    session: {
      id: session.id,
      session_number: session.session_number,
      label: session.label,
      day_number: session.day_number,
      format: session.format,
      match_count: session.match_count,
      start_at: session.start_at,
      pairings_revealed: session.pairings_revealed,
      status: session.status as "upcoming" | "in_progress" | "complete",
      tees_used: session.tees_used,
      points_per_match: Number(session.points_per_match),
    },
    teams: teamsArr,
    submissionStatus,
    matches,
    totals: {
      points_a: totalPointsA,
      points_b: totalPointsB,
      any_started: anyStarted,
    },
  };
}

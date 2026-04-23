import { createClient } from "@/lib/supabase/server";
import { computePlayerStrokes, type Allowance } from "@/lib/scoring/allowance";
import { strokesPerHole, type Hole } from "@/lib/scoring/strokes";
import {
  evaluateMatch,
  formatStatus,
  type HoleScoreRow,
  type MatchEvaluation,
} from "@/lib/scoring/evaluate";

export type MatchDetail = {
  tournament: {
    id: string;
    name: string;
    max_strokes_per_hole: number | null;
    end_match_early: boolean;
    concession_enabled: boolean;
  };
  session: {
    id: string;
    session_number: number;
    label: string;
    format: "foursomes" | "betterball" | "greensomes" | "scramble_2v2" | "singles";
    match_count: number;
    points_per_match: number;
    handicap_allowance: Allowance | null;
    tees_used: string | null;
  };
  match: {
    id: string;
    match_order: number;
    status: string;
    winning_team_id: string | null;
    points_team_a: number;
    points_team_b: number;
    ended_on_hole: number | null;
  };
  teamA: TeamSide;
  teamB: TeamSide;
  holes: Hole[];
  holeScores: HoleScoreRow[];
  evaluation: MatchEvaluation;
  statusText: string;
  strokesPerPlayer: Record<string, number>;
  perHoleStrokes: Record<string, Record<number, number>>;
};

type TeamInfo = {
  id: string;
  name: string;
  display_code: string;
  colour_primary: string;
};

type TeamSide = {
  team_id: string;
  team_name: string;
  team_display_code: string;
  team_colour: string;
  players: Array<{
    id: string;
    display_name: string;
    handicap: number | null;
    slot: number;
  }>;
};

export async function getMatchDetail(
  matchId: string
): Promise<MatchDetail | null> {
  const supabase = await createClient();

  const { data: match } = await supabase
    .from("match")
    .select("id, match_order, status, winning_team_id, points_team_a, points_team_b, ended_on_hole, session_id, team_a_pairing_id, team_b_pairing_id")
    .eq("id", matchId)
    .single();
  if (!match) return null;

  const { data: session } = await supabase
    .from("session")
    .select("id, session_number, label, format, match_count, points_per_match, handicap_allowance, tees_used, tournament_id")
    .eq("id", match.session_id)
    .single();
  if (!session) return null;

  const { data: tournament } = await supabase
    .from("tournament")
    .select("id, name, max_strokes_per_hole, end_match_early, concession_enabled")
    .eq("id", session.tournament_id)
    .single();
  if (!tournament) return null;

  const { data: teams } = await supabase
    .from("team")
    .select("id, name, display_code, display_order, colour_primary")
    .eq("tournament_id", tournament.id)
    .order("display_order", { ascending: true, nullsFirst: false });

  if (!teams || teams.length < 2) return null;

  const teamA: TeamInfo = {
    id: teams[0].id,
    name: teams[0].name,
    display_code: teams[0].display_code,
    colour_primary: teams[0].colour_primary,
  };
  const teamB: TeamInfo = {
    id: teams[1].id,
    name: teams[1].name,
    display_code: teams[1].display_code,
    colour_primary: teams[1].colour_primary,
  };

  const pairingIds = [match.team_a_pairing_id, match.team_b_pairing_id];
  const { data: pairingPlayers } = await supabase
    .from("pairing_player")
    .select("pairing_id, player_id, slot")
    .in("pairing_id", pairingIds);

  const playerIds = Array.from(
    new Set((pairingPlayers ?? []).map((pp) => pp.player_id))
  );

  const { data: playerRows } = await supabase
    .from("player")
    .select("id, display_name, handicap, team_id")
    .in("id", playerIds);

  const byId = new Map((playerRows ?? []).map((p) => [p.id, p]));

  function makeSide(pairingId: string, team: TeamInfo): TeamSide {
    const slots = (pairingPlayers ?? [])
      .filter((pp) => pp.pairing_id === pairingId)
      .sort((a, b) => a.slot - b.slot);
    return {
      team_id: team.id,
      team_name: team.name,
      team_display_code: team.display_code,
      team_colour: team.colour_primary,
      players: slots.map((s) => ({
        id: s.player_id,
        display_name: byId.get(s.player_id)?.display_name ?? "?",
        handicap: byId.get(s.player_id)?.handicap ?? null,
        slot: s.slot,
      })),
    };
  }

  const teamASide = makeSide(match.team_a_pairing_id, teamA);
  const teamBSide = makeSide(match.team_b_pairing_id, teamB);

  const { data: course } = await supabase
    .from("course")
    .select("id")
    .eq("tournament_id", tournament.id)
    .limit(1)
    .single();
  if (!course) return null;

  const { data: holeRows } = await supabase
    .from("hole")
    .select("hole_number, par, stroke_index")
    .eq("course_id", course.id)
    .order("hole_number", { ascending: true });

  const holes: Hole[] = (holeRows ?? []).map((h) => ({
    hole_number: h.hole_number,
    par: h.par,
    stroke_index: h.stroke_index,
  }));

  const { data: holeScoreRows } = await supabase
    .from("hole_score")
    .select("hole_number, scores, result")
    .eq("match_id", match.id)
    .order("hole_number", { ascending: true });

  const holeScores: HoleScoreRow[] = (holeScoreRows ?? []).map((r) => ({
    hole_number: r.hole_number,
    scores: r.scores as Record<string, unknown>,
    result: r.result as HoleScoreRow["result"],
  }));

  const allowance = (session.handicap_allowance as Allowance) ?? null;
  const effective = computePlayerStrokes(
    allowance,
    teamASide.players.map((p) => ({ player_id: p.id, handicap: p.handicap })),
    teamBSide.players.map((p) => ({ player_id: p.id, handicap: p.handicap }))
  );

  const perHoleStrokes: Record<string, Record<number, number>> = {};
  for (const pid of Object.keys(effective)) {
    perHoleStrokes[pid] = strokesPerHole(
      effective[pid],
      holes,
      tournament.max_strokes_per_hole
    );
  }

  const concededToA = match.status === "conceded" && match.winning_team_id === teamA.id;
  const concededToB = match.status === "conceded" && match.winning_team_id === teamB.id;
  const evaluation = evaluateMatch(
    holes,
    holeScores,
    session.points_per_match,
    tournament.end_match_early,
    concededToA ? "team_a" : concededToB ? "team_b" : null
  );
  const statusText = formatStatus(evaluation.status, teamA.name, teamB.name);

  return {
    tournament: {
      id: tournament.id,
      name: tournament.name,
      max_strokes_per_hole: tournament.max_strokes_per_hole,
      end_match_early: tournament.end_match_early,
      concession_enabled: tournament.concession_enabled,
    },
    session: {
      id: session.id,
      session_number: session.session_number,
      label: session.label,
      format: session.format as MatchDetail["session"]["format"],
      match_count: session.match_count,
      points_per_match: Number(session.points_per_match),
      handicap_allowance: allowance,
      tees_used: session.tees_used,
    },
    match: {
      id: match.id,
      match_order: match.match_order,
      status: match.status,
      winning_team_id: match.winning_team_id,
      points_team_a: Number(match.points_team_a),
      points_team_b: Number(match.points_team_b),
      ended_on_hole: match.ended_on_hole,
    },
    teamA: teamASide,
    teamB: teamBSide,
    holes,
    holeScores,
    evaluation,
    statusText,
    strokesPerPlayer: effective,
    perHoleStrokes,
  };
}

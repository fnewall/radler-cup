import { createClient } from "@/lib/supabase/server";
import { computeAllowance, type Allowance } from "@/lib/scoring/allowance";
import { strokesPerHole, type Hole } from "@/lib/scoring/strokes";

export type HoleEntryContext = {
  tournament: {
    name: string;
    concession_enabled: boolean;
    max_strokes_per_hole: number | null;
  };
  session: {
    id: string;
    label: string;
    format: "foursomes" | "betterball" | "greensomes" | "scramble_2v2" | "singles";
  };
  match: {
    id: string;
    match_order: number;
  };
  hole: {
    number: number;
    par: number;
    stroke_index: number;
    yardage: number | null;
  };
  teamA: TeamEntry;
  teamB: TeamEntry;
  existingScore: ExistingScore | null;
  navigation: {
    prev_hole: number | null;
    next_hole: number | null;
  };
};

export type TeamEntry = {
  team_id: string;
  team_name: string;
  team_display_code: string;
  team_colour: string;
  team_tint: string;
  players: Array<{
    id: string;
    display_name: string;
    handicap: number | null;
    slot: number;
    strokes_this_hole: number;
  }>;
  pair_strokes_this_hole: number;
};

export type ExistingScore = {
  result: string;
  scores: Record<string, unknown>;
};

export async function getHoleEntryContext(
  matchId: string,
  holeNumber: number
): Promise<HoleEntryContext | null> {
  const supabase = await createClient();

  const { data: match } = await supabase
    .from("match")
    .select("id, match_order, session_id, team_a_pairing_id, team_b_pairing_id")
    .eq("id", matchId)
    .single();
  if (!match) return null;

  const { data: session } = await supabase
    .from("session")
    .select("id, label, format, handicap_allowance, tees_used, tournament_id")
    .eq("id", match.session_id)
    .single();
  if (!session) return null;

  const { data: tournament } = await supabase
    .from("tournament")
    .select("id, name, concession_enabled, max_strokes_per_hole")
    .eq("id", session.tournament_id)
    .single();
  if (!tournament) return null;

  const { data: teams } = await supabase
    .from("team")
    .select("id, name, display_code, display_order, colour_primary, colour_bg_tint")
    .eq("tournament_id", tournament.id)
    .order("display_order", { ascending: true, nullsFirst: false });
  if (!teams || teams.length < 2) return null;

  const teamARow = teams[0];
  const teamBRow = teams[1];

  const { data: course } = await supabase
    .from("course")
    .select("id")
    .eq("tournament_id", tournament.id)
    .limit(1)
    .single();
  if (!course) return null;

  const { data: holeRows } = await supabase
    .from("hole")
    .select("hole_number, par, stroke_index, yardage_per_tee")
    .eq("course_id", course.id)
    .order("hole_number", { ascending: true });

  const holes: Hole[] = (holeRows ?? []).map((h) => ({
    hole_number: h.hole_number,
    par: h.par,
    stroke_index: h.stroke_index,
  }));

  const thisHoleRow = (holeRows ?? []).find((h) => h.hole_number === holeNumber);
  if (!thisHoleRow) return null;

  const yardageMap = thisHoleRow.yardage_per_tee as Record<string, number> | null;
  const yardage =
    session.tees_used && yardageMap && typeof yardageMap[session.tees_used] === "number"
      ? yardageMap[session.tees_used]
      : null;

  const { data: pairingPlayers } = await supabase
    .from("pairing_player")
    .select("pairing_id, player_id, slot")
    .in("pairing_id", [match.team_a_pairing_id, match.team_b_pairing_id]);

  const { data: playerRows } = await supabase
    .from("player")
    .select("id, display_name, handicap")
    .in("id", (pairingPlayers ?? []).map((pp) => pp.player_id));

  const byId = new Map((playerRows ?? []).map((p) => [p.id, p]));

  const teamAPlayers = (pairingPlayers ?? [])
    .filter((pp) => pp.pairing_id === match.team_a_pairing_id)
    .sort((a, b) => a.slot - b.slot);
  const teamBPlayers = (pairingPlayers ?? [])
    .filter((pp) => pp.pairing_id === match.team_b_pairing_id)
    .sort((a, b) => a.slot - b.slot);

  const allowance = computeAllowance(
    (session.handicap_allowance as Allowance) ?? null,
    teamAPlayers.map((pp) => ({
      player_id: pp.player_id,
      handicap: byId.get(pp.player_id)?.handicap ?? null,
    })),
    teamBPlayers.map((pp) => ({
      player_id: pp.player_id,
      handicap: byId.get(pp.player_id)?.handicap ?? null,
    }))
  );

  const perHoleStrokes: Record<string, Record<number, number>> = {};
  for (const pid of Object.keys(allowance.strokesByPlayer)) {
    perHoleStrokes[pid] = strokesPerHole(
      allowance.strokesByPlayer[pid],
      holes,
      tournament.max_strokes_per_hole
    );
  }

  function buildTeamEntry(
    team: typeof teamARow,
    pps: typeof teamAPlayers
  ): TeamEntry {
    const players = pps.map((pp) => {
      const p = byId.get(pp.player_id);
      return {
        id: pp.player_id,
        display_name: p?.display_name ?? "?",
        handicap: p?.handicap ?? null,
        slot: pp.slot,
        strokes_this_hole: perHoleStrokes[pp.player_id]?.[holeNumber] ?? 0,
      };
    });
    // Pair strokes for pair formats = the first player's strokes
    // (in pair scope both have equal values)
    const pair = pps[0] ? perHoleStrokes[pps[0].player_id]?.[holeNumber] ?? 0 : 0;
    return {
      team_id: team.id,
      team_name: team.name,
      team_display_code: team.display_code,
      team_colour: team.colour_primary,
      team_tint: team.colour_bg_tint,
      players,
      pair_strokes_this_hole: pair,
    };
  }

  const teamA = buildTeamEntry(teamARow, teamAPlayers);
  const teamB = buildTeamEntry(teamBRow, teamBPlayers);

  // Existing score
  const { data: existing } = await supabase
    .from("hole_score")
    .select("result, scores")
    .eq("match_id", match.id)
    .eq("hole_number", holeNumber)
    .maybeSingle();

  const existingScore: ExistingScore | null = existing
    ? {
        result: existing.result as string,
        scores: existing.scores as Record<string, unknown>,
      }
    : null;

  // Navigation: prev/next hole numbers (clamped to 1-18)
  const prev_hole = holeNumber > 1 ? holeNumber - 1 : null;
  const next_hole = holeNumber < 18 ? holeNumber + 1 : null;

  return {
    tournament: {
      name: tournament.name,
      concession_enabled: tournament.concession_enabled,
      max_strokes_per_hole: tournament.max_strokes_per_hole,
    },
    session: {
      id: session.id,
      label: session.label,
      format: session.format as HoleEntryContext["session"]["format"],
    },
    match: {
      id: match.id,
      match_order: match.match_order,
    },
    hole: {
      number: holeNumber,
      par: thisHoleRow.par,
      stroke_index: thisHoleRow.stroke_index,
      yardage,
    },
    teamA,
    teamB,
    existingScore,
    navigation: {
      prev_hole,
      next_hole,
    },
  };
}

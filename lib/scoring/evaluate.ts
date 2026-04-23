import type { Hole } from "./strokes";

export type Format =
  | "foursomes"
  | "betterball"
  | "greensomes"
  | "scramble_2v2"
  | "singles";

export type HoleScoreRow = {
  hole_number: number;
  scores: Record<string, unknown>; // raw jsonb shape from DB
  result: "team_a" | "team_b" | "halved" | "conceded_to_a" | "conceded_to_b";
};

export type HoleOutcome = {
  hole_number: number;
  par: number;
  result: "team_a" | "team_b" | "halved" | "conceded_to_a" | "conceded_to_b";
  team_a_net: number | null;
  team_b_net: number | null;
  is_conceded: boolean;
};

export type MatchStatus =
  | { state: "all_square"; thru: number }
  | { state: "team_a_up"; by: number; thru: number }
  | { state: "team_b_up"; by: number; thru: number }
  | { state: "team_a_wins"; by: string; thru: number } // e.g. "4&3"
  | { state: "team_b_wins"; by: string; thru: number }
  | { state: "halved"; thru: 18 }
  | { state: "conceded_to_a" }
  | { state: "conceded_to_b" };

export type MatchEvaluation = {
  outcomes: HoleOutcome[];
  status: MatchStatus;
  points: { team_a: number; team_b: number };
  ended_on_hole: number | null;
  // true if match is done (mathematically decided or 18 holes played or conceded whole)
  complete: boolean;
};

/**
 * Compute match status from a list of hole scores. This is UI-driven — no DB
 * writes here; server reconciles on each hole_score insert/update if needed.
 */
export function evaluateMatch(
  holes: Hole[],
  scoreRows: HoleScoreRow[],
  pointsPerMatch: number,
  endMatchEarly: boolean,
  overallMatchConcededTo?: "team_a" | "team_b" | null
): MatchEvaluation {
  // Whole-match concession short-circuits
  if (overallMatchConcededTo === "team_a") {
    return {
      outcomes: [],
      status: { state: "conceded_to_a" },
      points: { team_a: pointsPerMatch, team_b: 0 },
      ended_on_hole: null,
      complete: true,
    };
  }
  if (overallMatchConcededTo === "team_b") {
    return {
      outcomes: [],
      status: { state: "conceded_to_b" },
      points: { team_a: 0, team_b: pointsPerMatch },
      ended_on_hole: null,
      complete: true,
    };
  }

  const outcomesByHole: Record<number, HoleOutcome> = {};
  for (const h of holes) {
    outcomesByHole[h.hole_number] = {
      hole_number: h.hole_number,
      par: h.par,
      result: "halved",
      team_a_net: null,
      team_b_net: null,
      is_conceded: false,
    };
  }

  const sortedRows = [...scoreRows].sort((a, b) => a.hole_number - b.hole_number);
  const playedRows: HoleScoreRow[] = sortedRows;

  for (const row of playedRows) {
    const hole = holes.find((h) => h.hole_number === row.hole_number);
    if (!hole) continue;

    const scores = row.scores as
      | {
          team_a?: { gross?: number | null; net?: number | null; p1_net?: number; p2_net?: number };
          team_b?: { gross?: number | null; net?: number | null; p1_net?: number; p2_net?: number };
        }
      | undefined;

    const teamANet =
      scores?.team_a && "net" in scores.team_a && typeof scores.team_a.net === "number"
        ? scores.team_a.net
        : null;
    const teamBNet =
      scores?.team_b && "net" in scores.team_b && typeof scores.team_b.net === "number"
        ? scores.team_b.net
        : null;

    outcomesByHole[row.hole_number] = {
      hole_number: row.hole_number,
      par: hole.par,
      result: row.result,
      team_a_net: teamANet,
      team_b_net: teamBNet,
      is_conceded:
        row.result === "conceded_to_a" || row.result === "conceded_to_b",
    };
  }

  // Walk through holes 1..18 in order and track the running match delta
  let delta = 0; // positive = team A up
  let lastPlayedHole = 0;
  const decidedEarly: { winner: "team_a" | "team_b"; by: string; thru: number } | null = (() => {
    for (let i = 1; i <= 18; i++) {
      const outcome = outcomesByHole[i];
      if (!outcome) break;
      // Unplayed — stop walking
      const played = playedRows.some((r) => r.hole_number === i);
      if (!played) break;

      lastPlayedHole = i;

      // Apply this hole's delta
      if (outcome.result === "team_a" || outcome.result === "conceded_to_a") {
        delta += 1;
      } else if (outcome.result === "team_b" || outcome.result === "conceded_to_b") {
        delta -= 1;
      }

      // Check if mathematically decided (only if endMatchEarly)
      const remaining = 18 - i;
      if (endMatchEarly && Math.abs(delta) > remaining) {
        const by = `${Math.abs(delta)}&${remaining}`;
        return {
          winner: delta > 0 ? "team_a" : "team_b",
          by,
          thru: i,
        };
      }
    }
    return null;
  })();

  // Status
  let status: MatchStatus;
  let complete = false;
  let endedOnHole: number | null = null;
  let pointsA = 0;
  let pointsB = 0;

  if (decidedEarly) {
    status = {
      state: decidedEarly.winner === "team_a" ? "team_a_wins" : "team_b_wins",
      by: decidedEarly.by,
      thru: decidedEarly.thru,
    };
    complete = true;
    endedOnHole = decidedEarly.thru;
    if (decidedEarly.winner === "team_a") {
      pointsA = pointsPerMatch;
    } else {
      pointsB = pointsPerMatch;
    }
  } else if (lastPlayedHole === 18) {
    // Played all 18 and not mathematically decided
    if (delta === 0) {
      status = { state: "halved", thru: 18 };
      pointsA = pointsPerMatch / 2;
      pointsB = pointsPerMatch / 2;
    } else if (delta > 0) {
      status = { state: "team_a_wins", by: `${delta}UP`, thru: 18 };
      pointsA = pointsPerMatch;
    } else {
      status = { state: "team_b_wins", by: `${Math.abs(delta)}UP`, thru: 18 };
      pointsB = pointsPerMatch;
    }
    complete = true;
    endedOnHole = 18;
  } else {
    // In progress
    if (delta === 0) {
      status = { state: "all_square", thru: lastPlayedHole };
    } else if (delta > 0) {
      status = { state: "team_a_up", by: delta, thru: lastPlayedHole };
    } else {
      status = { state: "team_b_up", by: Math.abs(delta), thru: lastPlayedHole };
    }
  }

  return {
    outcomes: Object.values(outcomesByHole).sort(
      (a, b) => a.hole_number - b.hole_number
    ),
    status,
    points: { team_a: pointsA, team_b: pointsB },
    ended_on_hole: endedOnHole,
    complete,
  };
}

export function formatStatus(status: MatchStatus, teamAName: string, teamBName: string): string {
  switch (status.state) {
    case "all_square":
      return `All square thru ${status.thru}`;
    case "team_a_up":
      return `${teamAName} ${status.by} UP thru ${status.thru}`;
    case "team_b_up":
      return `${teamBName} ${status.by} UP thru ${status.thru}`;
    case "team_a_wins":
      return `${teamAName} wins ${status.by}`;
    case "team_b_wins":
      return `${teamBName} wins ${status.by}`;
    case "halved":
      return "Halved";
    case "conceded_to_a":
      return `${teamAName} wins (conceded)`;
    case "conceded_to_b":
      return `${teamBName} wins (conceded)`;
  }
}

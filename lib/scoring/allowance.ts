// Given a session's handicap_allowance config and the players involved,
// compute the effective handicap each player is "playing off" for match play.
// The scoring engine turns that into per-hole strokes via stroke index.

export type Allowance =
  | { type: "combined_diff"; pct: number }
  | { type: "individual"; pct: number }
  | { type: "split"; low_pct: number; high_pct: number }
  | { type: "individual_diff"; pct: number }
  | { type: "flat"; pct: number };

export type PlayerHandicap = {
  player_id: string;
  handicap: number | null;
};

// Returns a map of player_id -> effective strokes they receive for this match.
// For pair formats, the "pair's strokes" are distributed to both players so
// downstream stroke-index logic just uses per-player strokes.
export function computePlayerStrokes(
  allowance: Allowance | null | undefined,
  teamA: PlayerHandicap[],
  teamB: PlayerHandicap[]
): Record<string, number> {
  const result: Record<string, number> = {};

  // If any handicap is missing, treat as 0 rather than crashing.
  const hcp = (p: PlayerHandicap) => p.handicap ?? 0;

  if (!allowance || !("type" in allowance)) {
    // No allowance config — give everyone their full handicap.
    for (const p of [...teamA, ...teamB]) result[p.player_id] = hcp(p);
    return result;
  }

  const pct = (n: number, p: number) => Math.round(n * (p / 100) * 10) / 10;

  switch (allowance.type) {
    case "individual": {
      // e.g. Betterball 85% — each player gets their own hcp * pct.
      // After allowance, subtract the lowest so the best player plays off 0.
      const combined = [...teamA, ...teamB];
      const adjusted: Record<string, number> = {};
      for (const p of combined) adjusted[p.player_id] = pct(hcp(p), allowance.pct);
      const min = Math.min(...Object.values(adjusted));
      for (const id of Object.keys(adjusted)) {
        result[id] = Math.round((adjusted[id] - min) * 10) / 10;
      }
      return result;
    }

    case "individual_diff": {
      // Singles: the higher-handicap player gets the difference * pct.
      // Pair case shouldn't use this but handle gracefully.
      const [a] = teamA;
      const [b] = teamB;
      if (!a || !b) {
        for (const p of [...teamA, ...teamB]) result[p.player_id] = 0;
        return result;
      }
      const ha = hcp(a);
      const hb = hcp(b);
      const diff = pct(Math.abs(ha - hb), allowance.pct);
      result[a.player_id] = ha > hb ? diff : 0;
      result[b.player_id] = hb > ha ? diff : 0;
      return result;
    }

    case "combined_diff": {
      // Foursomes default: pair's combined handicap difference * pct,
      // all given to the weaker pair's players (split 0/half/half evenly).
      const sumA = teamA.reduce((s, p) => s + hcp(p), 0);
      const sumB = teamB.reduce((s, p) => s + hcp(p), 0);
      const diff = pct(Math.abs(sumA - sumB), allowance.pct);
      const weakerTeam = sumA > sumB ? teamA : teamB;
      const strongerTeam = sumA > sumB ? teamB : teamA;
      for (const p of strongerTeam) result[p.player_id] = 0;
      // In foursomes there's one ball per pair, so strokes apply to the pair.
      // For our stroke-per-player model we put the full diff on the weaker pair's
      // "lead" player and 0 on the partner — either way, when computing the pair's
      // net, we use the team-level strokes.
      // To keep it simple: give full diff to each of the weaker pair's players.
      // The match evaluator will treat foursomes as a single pair-level score anyway.
      for (const p of weakerTeam) result[p.player_id] = diff;
      return result;
    }

    case "split": {
      // Greensomes / scramble style: low% of lower hcp + high% of higher hcp per pair.
      function pairStrokes(team: PlayerHandicap[]): number {
        if (team.length < 2) return pct(hcp(team[0] ?? { handicap: 0, player_id: "" }), allowance.low_pct);
        const sorted = [...team].sort((a, b) => hcp(a) - hcp(b));
        const low = hcp(sorted[0]);
        const high = hcp(sorted[1]);
        return (
          Math.round((low * (allowance.low_pct / 100) + high * (allowance.high_pct / 100)) * 10) /
          10
        );
      }
      const pairA = pairStrokes(teamA);
      const pairB = pairStrokes(teamB);
      // Give the pair strokes to the weaker pair (in match play, only the difference matters)
      const diff = Math.abs(pairA - pairB);
      const weakerTeam = pairA > pairB ? teamA : teamB;
      const strongerTeam = pairA > pairB ? teamB : teamA;
      for (const p of strongerTeam) result[p.player_id] = 0;
      for (const p of weakerTeam) result[p.player_id] = Math.round(diff * 10) / 10;
      return result;
    }

    case "flat": {
      // One % applied to every player's handicap.
      for (const p of [...teamA, ...teamB]) {
        result[p.player_id] = pct(hcp(p), allowance.pct);
      }
      // In pair formats we often want this as a pair-level allowance; since we
      // apply per-hole via SI individually, the behaviour is similar to "individual".
      return result;
    }

    default: {
      for (const p of [...teamA, ...teamB]) result[p.player_id] = hcp(p);
      return result;
    }
  }
}

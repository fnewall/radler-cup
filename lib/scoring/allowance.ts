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

  const hcp = (p: PlayerHandicap) => p.handicap ?? 0;

  if (!allowance || !("type" in allowance)) {
    for (const p of [...teamA, ...teamB]) result[p.player_id] = hcp(p);
    return result;
  }

  const applyPct = (n: number, p: number) => Math.round(n * (p / 100) * 10) / 10;

  switch (allowance.type) {
    case "individual": {
      const pct = allowance.pct;
      const combined = [...teamA, ...teamB];
      const adjusted: Record<string, number> = {};
      for (const p of combined) adjusted[p.player_id] = applyPct(hcp(p), pct);
      const min = Math.min(...Object.values(adjusted));
      for (const id of Object.keys(adjusted)) {
        result[id] = Math.round((adjusted[id] - min) * 10) / 10;
      }
      return result;
    }

    case "individual_diff": {
      const pct = allowance.pct;
      const [a] = teamA;
      const [b] = teamB;
      if (!a || !b) {
        for (const p of [...teamA, ...teamB]) result[p.player_id] = 0;
        return result;
      }
      const ha = hcp(a);
      const hb = hcp(b);
      const diff = applyPct(Math.abs(ha - hb), pct);
      result[a.player_id] = ha > hb ? diff : 0;
      result[b.player_id] = hb > ha ? diff : 0;
      return result;
    }

    case "combined_diff": {
      const pct = allowance.pct;
      const sumA = teamA.reduce((s, p) => s + hcp(p), 0);
      const sumB = teamB.reduce((s, p) => s + hcp(p), 0);
      const diff = applyPct(Math.abs(sumA - sumB), pct);
      const weakerTeam = sumA > sumB ? teamA : teamB;
      const strongerTeam = sumA > sumB ? teamB : teamA;
      for (const p of strongerTeam) result[p.player_id] = 0;
      for (const p of weakerTeam) result[p.player_id] = diff;
      return result;
    }

    case "split": {
      const lowPct = allowance.low_pct;
      const highPct = allowance.high_pct;
      function pairStrokes(team: PlayerHandicap[]): number {
        if (team.length === 0) return 0;
        if (team.length < 2) return applyPct(hcp(team[0]), lowPct);
        const sorted = [...team].sort((a, b) => hcp(a) - hcp(b));
        const low = hcp(sorted[0]);
        const high = hcp(sorted[1]);
        return (
          Math.round((low * (lowPct / 100) + high * (highPct / 100)) * 10) / 10
        );
      }
      const pairA = pairStrokes(teamA);
      const pairB = pairStrokes(teamB);
      const diff = Math.abs(pairA - pairB);
      const weakerTeam = pairA > pairB ? teamA : teamB;
      const strongerTeam = pairA > pairB ? teamB : teamA;
      for (const p of strongerTeam) result[p.player_id] = 0;
      for (const p of weakerTeam) result[p.player_id] = Math.round(diff * 10) / 10;
      return result;
    }

    case "flat": {
      const pct = allowance.pct;
      for (const p of [...teamA, ...teamB]) {
        result[p.player_id] = applyPct(hcp(p), pct);
      }
      return result;
    }

    default: {
      for (const p of [...teamA, ...teamB]) result[p.player_id] = hcp(p);
      return result;
    }
  }
}

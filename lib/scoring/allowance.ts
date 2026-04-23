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

// Scope of the allowance: is it an individual per-player allowance (betterball,
// singles) or a pair-level allowance where the weaker pair plays off N strokes
// as a team (foursomes, greensomes, scramble)?
export type AllowanceScope = "individual" | "pair";

export type ComputedAllowance = {
  scope: AllowanceScope;
  // For "individual": strokes per player.
  // For "pair": strokes assigned to the weaker pair (both players' player_id
  //   map to the same pair-level figure; stroke-per-hole then uses it once).
  strokesByPlayer: Record<string, number>;
  // For "pair": which side is the weaker pair (receives strokes)
  weakerSide?: "team_a" | "team_b";
};

export function computeAllowance(
  allowance: Allowance | null | undefined,
  teamA: PlayerHandicap[],
  teamB: PlayerHandicap[]
): ComputedAllowance {
  const strokesByPlayer: Record<string, number> = {};
  const hcp = (p: PlayerHandicap) => p.handicap ?? 0;

  if (!allowance || !("type" in allowance)) {
    for (const p of [...teamA, ...teamB]) strokesByPlayer[p.player_id] = hcp(p);
    return { scope: "individual", strokesByPlayer };
  }

  const applyPct = (n: number, p: number) => n * (p / 100);
  const round = (n: number) => Math.round(n);

  switch (allowance.type) {
    case "individual": {
      // Betterball: each player gets own hcp * pct, then subtract the lowest.
      const pct = allowance.pct;
      const combined = [...teamA, ...teamB];
      const raw: Record<string, number> = {};
      for (const p of combined) raw[p.player_id] = applyPct(hcp(p), pct);
      const min = Math.min(...Object.values(raw));
      for (const id of Object.keys(raw)) {
        strokesByPlayer[id] = round(raw[id] - min);
      }
      return { scope: "individual", strokesByPlayer };
    }

    case "individual_diff": {
      // Singles: higher-hcp gets the diff * pct.
      const pct = allowance.pct;
      const [a] = teamA;
      const [b] = teamB;
      if (!a || !b) {
        for (const p of [...teamA, ...teamB]) strokesByPlayer[p.player_id] = 0;
        return { scope: "individual", strokesByPlayer };
      }
      const ha = hcp(a);
      const hb = hcp(b);
      const diff = round(applyPct(Math.abs(ha - hb), pct));
      strokesByPlayer[a.player_id] = ha > hb ? diff : 0;
      strokesByPlayer[b.player_id] = hb > ha ? diff : 0;
      return { scope: "individual", strokesByPlayer };
    }

    case "combined_diff": {
      // Foursomes: pair's combined handicap difference * pct → pair allowance.
      const pct = allowance.pct;
      const sumA = teamA.reduce((s, p) => s + hcp(p), 0);
      const sumB = teamB.reduce((s, p) => s + hcp(p), 0);
      const diff = round(applyPct(Math.abs(sumA - sumB), pct));
      const weaker = sumA > sumB ? "team_a" : "team_b";
      const weakerTeam = weaker === "team_a" ? teamA : teamB;
      const strongerTeam = weaker === "team_a" ? teamB : teamA;
      for (const p of strongerTeam) strokesByPlayer[p.player_id] = 0;
      for (const p of weakerTeam) strokesByPlayer[p.player_id] = diff;
      return { scope: "pair", strokesByPlayer, weakerSide: weaker };
    }

    case "split": {
      // Greensomes / scramble: weighted per-pair allowance.
      const lowPct = allowance.low_pct;
      const highPct = allowance.high_pct;
      function pairStrokes(team: PlayerHandicap[]): number {
        if (team.length === 0) return 0;
        if (team.length < 2) return applyPct(hcp(team[0]), lowPct);
        const sorted = [...team].sort((a, b) => hcp(a) - hcp(b));
        return applyPct(hcp(sorted[0]), lowPct) + applyPct(hcp(sorted[1]), highPct);
      }
      const pairA = pairStrokes(teamA);
      const pairB = pairStrokes(teamB);
      const diff = round(Math.abs(pairA - pairB));
      const weaker = pairA > pairB ? "team_a" : "team_b";
      const weakerTeam = weaker === "team_a" ? teamA : teamB;
      const strongerTeam = weaker === "team_a" ? teamB : teamA;
      for (const p of strongerTeam) strokesByPlayer[p.player_id] = 0;
      for (const p of weakerTeam) strokesByPlayer[p.player_id] = diff;
      return { scope: "pair", strokesByPlayer, weakerSide: weaker };
    }

    case "flat": {
      // Flat % of each player's handicap. Default scope: individual.
      const pct = allowance.pct;
      for (const p of [...teamA, ...teamB]) {
        strokesByPlayer[p.player_id] = round(applyPct(hcp(p), pct));
      }
      return { scope: "individual", strokesByPlayer };
    }

    default: {
      for (const p of [...teamA, ...teamB]) strokesByPlayer[p.player_id] = hcp(p);
      return { scope: "individual", strokesByPlayer };
    }
  }
}

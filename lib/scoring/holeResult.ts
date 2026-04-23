import type { Format } from "./evaluate";

export type FoursomesInput = {
  team_a: { gross: number | null };
  team_b: { gross: number | null };
};

export type BetterballInput = {
  team_a: { p1_gross: number | null; p2_gross: number | null };
  team_b: { p1_gross: number | null; p2_gross: number | null };
};

export type StrokesForHole = {
  team_a_pair?: number;
  team_b_pair?: number;
  team_a_players?: Record<string, number>;
  team_b_players?: Record<string, number>;
};

export type PlayerIdMap = {
  team_a_p1?: string;
  team_a_p2?: string;
  team_b_p1?: string;
  team_b_p2?: string;
};

export type HoleComputation = {
  stored_scores: Record<string, unknown>;
  team_a_net: number | null;
  team_b_net: number | null;
  result: "team_a" | "team_b" | "halved" | "conceded_to_a" | "conceded_to_b";
};

function lookupStrokes(
  pid: string | undefined,
  map: Record<string, number> | undefined
): number {
  if (!pid) return 0;
  if (!map) return 0;
  const v = map[pid];
  return typeof v === "number" ? v : 0;
}

export function computeHoleResult(
  format: Format,
  grossInputs: FoursomesInput | BetterballInput,
  strokes: StrokesForHole,
  playerIds: PlayerIdMap
): HoleComputation {
  if (format === "betterball") {
    const bb = grossInputs as BetterballInput;

    const aP1Gross = bb.team_a.p1_gross;
    const aP2Gross = bb.team_a.p2_gross;
    const bP1Gross = bb.team_b.p1_gross;
    const bP2Gross = bb.team_b.p2_gross;

    const aP1Strokes = lookupStrokes(playerIds.team_a_p1, strokes.team_a_players);
    const aP2Strokes = lookupStrokes(playerIds.team_a_p2, strokes.team_a_players);
    const bP1Strokes = lookupStrokes(playerIds.team_b_p1, strokes.team_b_players);
    const bP2Strokes = lookupStrokes(playerIds.team_b_p2, strokes.team_b_players);

    const aP1Net = aP1Gross !== null ? aP1Gross - aP1Strokes : null;
    const aP2Net = aP2Gross !== null ? aP2Gross - aP2Strokes : null;
    const bP1Net = bP1Gross !== null ? bP1Gross - bP1Strokes : null;
    const bP2Net = bP2Gross !== null ? bP2Gross - bP2Strokes : null;

    const teamANet = bestNet(aP1Net, aP2Net);
    const teamBNet = bestNet(bP1Net, bP2Net);

    const stored = {
      team_a: {
        p1_gross: aP1Gross,
        p2_gross: aP2Gross,
        p1_net: aP1Net,
        p2_net: aP2Net,
        net: teamANet,
      },
      team_b: {
        p1_gross: bP1Gross,
        p2_gross: bP2Gross,
        p1_net: bP1Net,
        p2_net: bP2Net,
        net: teamBNet,
      },
    };

    return {
      stored_scores: stored,
      team_a_net: teamANet,
      team_b_net: teamBNet,
      result: decideResult(teamANet, teamBNet),
    };
  }

  const fs = grossInputs as FoursomesInput;
  const aGross = fs.team_a.gross;
  const bGross = fs.team_b.gross;
  const aStrokes = strokes.team_a_pair ?? 0;
  const bStrokes = strokes.team_b_pair ?? 0;

  const aNet = aGross !== null ? aGross - aStrokes : null;
  const bNet = bGross !== null ? bGross - bStrokes : null;

  return {
    stored_scores: {
      team_a: { gross: aGross, net: aNet },
      team_b: { gross: bGross, net: bNet },
    },
    team_a_net: aNet,
    team_b_net: bNet,
    result: decideResult(aNet, bNet),
  };
}

function bestNet(a: number | null, b: number | null): number | null {
  if (a === null && b === null) return null;
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}

function decideResult(
  a: number | null,
  b: number | null
): "team_a" | "team_b" | "halved" {
  if (a === null || b === null) return "halved";
  if (a < b) return "team_a";
  if (b < a) return "team_b";
  return "halved";
}

export function computeConcededHole(
  format: Format,
  concededTo: "team_a" | "team_b",
  par: number,
  grossInputs: FoursomesInput | BetterballInput | null,
  strokes: StrokesForHole,
  playerIds: PlayerIdMap
): HoleComputation {
  const losingSide = concededTo === "team_a" ? "team_b" : "team_a";
  const result = concededTo === "team_a" ? "conceded_to_a" : "conceded_to_b";

  if (format === "betterball") {
    const bb = (grossInputs as BetterballInput | null) ?? {
      team_a: { p1_gross: null, p2_gross: null },
      team_b: { p1_gross: null, p2_gross: null },
    };

    const aP1Strokes = lookupStrokes(playerIds.team_a_p1, strokes.team_a_players);
    const aP2Strokes = lookupStrokes(playerIds.team_a_p2, strokes.team_a_players);
    const bP1Strokes = lookupStrokes(playerIds.team_b_p1, strokes.team_b_players);
    const bP2Strokes = lookupStrokes(playerIds.team_b_p2, strokes.team_b_players);

    const conceded = (g: number | null, stk: number) =>
      g !== null ? g - stk : par + 2;

    const aP1Net = losingSide === "team_a" ? conceded(bb.team_a.p1_gross, aP1Strokes) : null;
    const aP2Net = losingSide === "team_a" ? conceded(bb.team_a.p2_gross, aP2Strokes) : null;
    const bP1Net = losingSide === "team_b" ? conceded(bb.team_b.p1_gross, bP1Strokes) : null;
    const bP2Net = losingSide === "team_b" ? conceded(bb.team_b.p2_gross, bP2Strokes) : null;

    const teamANet = bestNet(aP1Net, aP2Net);
    const teamBNet = bestNet(bP1Net, bP2Net);

    return {
      stored_scores: {
        team_a: {
          p1_gross: bb.team_a.p1_gross,
          p2_gross: bb.team_a.p2_gross,
          p1_net: aP1Net,
          p2_net: aP2Net,
          net: teamANet,
          conceded: losingSide === "team_a",
        },
        team_b: {
          p1_gross: bb.team_b.p1_gross,
          p2_gross: bb.team_b.p2_gross,
          p1_net: bP1Net,
          p2_net: bP2Net,
          net: teamBNet,
          conceded: losingSide === "team_b",
        },
      },
      team_a_net: teamANet,
      team_b_net: teamBNet,
      result,
    };
  }

  const fs = (grossInputs as FoursomesInput | null) ?? {
    team_a: { gross: null },
    team_b: { gross: null },
  };

  const aStrokes = strokes.team_a_pair ?? 0;
  const bStrokes = strokes.team_b_pair ?? 0;

  const conceded = (g: number | null, stk: number) =>
    g !== null ? g - stk : par + 2;

  const aNet = losingSide === "team_a" ? conceded(fs.team_a.gross, aStrokes) : null;
  const bNet = losingSide === "team_b" ? conceded(fs.team_b.gross, bStrokes) : null;

  return {
    stored_scores: {
      team_a: {
        gross: fs.team_a.gross,
        net: aNet,
        conceded: losingSide === "team_a",
      },
      team_b: {
        gross: fs.team_b.gross,
        net: bNet,
        conceded: losingSide === "team_b",
      },
    },
    team_a_net: aNet,
    team_b_net: bNet,
    result,
  };
}

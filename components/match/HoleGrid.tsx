"use client";

import Link from "next/link";
import type { HoleOutcome } from "@/lib/scoring/evaluate";

type PlayerLite = {
  id: string;
  display_name: string;
};

type Props = {
  matchId: string;
  format: "foursomes" | "betterball" | "greensomes" | "scramble_2v2" | "singles";
  holes: Array<{ hole_number: number; par: number; stroke_index: number }>;
  outcomes: HoleOutcome[];
  playedHoleNumbers: Set<number>;
  teamA: {
    display_code: string;
    colour: string;
    players: PlayerLite[];
  };
  teamB: {
    display_code: string;
    colour: string;
    players: PlayerLite[];
  };
  perHoleStrokes: Record<string, Record<number, number>>;
  currentHole: number | null;
  canEdit: boolean;
};

type Pip = { label: string; count: number };

export function HoleGrid({
  matchId,
  format,
  holes,
  outcomes,
  playedHoleNumbers,
  teamA,
  teamB,
  perHoleStrokes,
  currentHole,
  canEdit,
}: Props) {
  const isPair =
    format === "foursomes" ||
    format === "greensomes" ||
    format === "scramble_2v2";

  // Running match state at each played hole
  const runningState: Record<number, { delta: number }> = {};
  let delta = 0;
  for (let i = 1; i <= 18; i++) {
    const outcome = outcomes.find((o) => o.hole_number === i);
    if (!outcome || !playedHoleNumbers.has(i)) continue;
    if (outcome.result === "team_a" || outcome.result === "conceded_to_a") {
      delta += 1;
    } else if (outcome.result === "team_b" || outcome.result === "conceded_to_b") {
      delta -= 1;
    }
    runningState[i] = { delta };
  }

  // Pips for one team on one hole.
  // Pair formats collapse to a single pip with the team code.
  // Individual formats (betterball, singles) show one pip per player with that player's initial.
  function pipsForTeam(
    team: { display_code: string; players: PlayerLite[] },
    hole: number
  ): Pip[] {
    const playerPips: Pip[] = team.players
      .map((p) => ({
        label: (p.display_name || "?")[0].toUpperCase(),
        count: perHoleStrokes[p.id]?.[hole] ?? 0,
      }))
      .filter((pp) => pp.count > 0);

    if (playerPips.length === 0) return [];

    if (isPair && playerPips.length === team.players.length) {
      // Collapse pair if everyone shares the same count
      const counts = playerPips.map((p) => p.count);
      const same = counts.every((c) => c === counts[0]);
      if (same) {
        return [{ label: team.display_code, count: counts[0] }];
      }
    }

    return playerPips;
  }

  function renderCell(holeNumber: number) {
    const hole = holes.find((h) => h.hole_number === holeNumber);
    const isCurrent = currentHole === holeNumber;
    const played = playedHoleNumbers.has(holeNumber);
    const state = runningState[holeNumber];

    const pipsA = pipsForTeam(teamA, holeNumber);
    const pipsB = pipsForTeam(teamB, holeNumber);
    const hasShots = pipsA.length > 0 || pipsB.length > 0;

    let fillStyle: React.CSSProperties = { backgroundColor: "#0F1512" };
    let centreContent: React.ReactNode = null;
    let holeNumberColour = "text-ink-500";
    let parColour = "text-ink-600";
    let borderClass = "border-ink-800";

    if (played && state) {
      if (state.delta === 0) {
        fillStyle = { backgroundColor: "#2A3831" };
        centreContent = (
          <div className="font-mono tabular text-sm md:text-base font-medium text-ink-200">
            AS
          </div>
        );
      } else if (state.delta > 0) {
        fillStyle = { backgroundColor: teamA.colour };
        holeNumberColour = "text-white/60";
        parColour = "text-white/40";
        centreContent = (
          <div className="font-mono tabular text-sm md:text-base font-semibold text-white leading-none">
            {state.delta}↑
          </div>
        );
      } else {
        fillStyle = { backgroundColor: teamB.colour };
        holeNumberColour = "text-white/60";
        parColour = "text-white/40";
        centreContent = (
          <div className="font-mono tabular text-sm md:text-base font-semibold text-white leading-none">
            {Math.abs(state.delta)}↑
          </div>
        );
      }
    }

    if (isCurrent) {
      borderClass = "border-schloss-bright border-2";
      if (!centreContent) {
        centreContent = (
          <div className="text-[9px] uppercase tracking-widest text-schloss-bright">
            now
          </div>
        );
      }
    }

    const content = (
      <div
        className={`relative aspect-square flex items-center justify-center rounded-sm border ${borderClass} overflow-hidden`}
        style={fillStyle}
      >
        <div
          className={`absolute top-1 left-1 text-[10px] font-mono tabular leading-none ${holeNumberColour}`}
        >
          {holeNumber}
        </div>
        {hole && (
          <div
            className={`absolute top-1 right-1 text-[9px] leading-none ${parColour}`}
          >
            P{hole.par}
          </div>
        )}
        {centreContent}

        {/* Per-player shot pips — bottom of cell.
            Left half = team A receivers, right half = team B receivers. */}
        {hasShots && (
          <div className="absolute bottom-0 left-0 right-0 flex pointer-events-none">
            <div className="flex-1 flex items-center justify-start gap-px pl-0.5 pb-0.5">
              {pipsA.map((p, i) => (
                <ShotPip key={`a-${i}`} pip={p} />
              ))}
            </div>
            <div className="flex-1 flex items-center justify-end gap-px pr-0.5 pb-0.5">
              {pipsB.map((p, i) => (
                <ShotPip key={`b-${i}`} pip={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    );

    if (canEdit) {
      return (
        <Link
          key={holeNumber}
          href={`/match/${matchId}/hole/${holeNumber}`}
          className="block"
        >
          {content}
        </Link>
      );
    }
    return <div key={holeNumber}>{content}</div>;
  }

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-9 gap-1.5">
        {Array.from({ length: 9 }, (_, i) => renderCell(i + 1))}
      </div>
      <div className="grid grid-cols-9 gap-1.5">
        {Array.from({ length: 9 }, (_, i) => renderCell(i + 10))}
      </div>
    </div>
  );
}

function ShotPip({ pip }: { pip: Pip }) {
  return (
    <div className="h-3.5 min-w-[14px] px-0.5 inline-flex items-center justify-center rounded-[2px] bg-shot-accent">
      <span className="text-[9px] font-bold leading-none text-shot-bg">
        {pip.label}
        {pip.count > 1 && (
          <sup className="text-[7px] ml-px">{pip.count}</sup>
        )}
      </span>
    </div>
  );
}

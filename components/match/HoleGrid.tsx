"use client";

import Link from "next/link";
import type { HoleOutcome } from "@/lib/scoring/evaluate";

type Props = {
  matchId: string;
  holes: Array<{ hole_number: number; par: number; stroke_index: number }>;
  outcomes: HoleOutcome[];
  playedHoleNumbers: Set<number>;
  teamA: { display_code: string; colour: string };
  teamB: { display_code: string; colour: string };
  currentHole: number | null;
  canEdit: boolean;
};

export function HoleGrid({
  matchId,
  holes,
  outcomes,
  playedHoleNumbers,
  teamA,
  teamB,
  currentHole,
  canEdit,
}: Props) {
  // Pre-compute the running match state at each played hole.
  // delta > 0 = team A up by |delta|, delta < 0 = team B up.
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

  function renderCell(holeNumber: number) {
    const hole = holes.find((h) => h.hole_number === holeNumber);
    const isCurrent = currentHole === holeNumber;
    const played = playedHoleNumbers.has(holeNumber);
    const state = runningState[holeNumber];

    // Cell appearance
    let fillStyle: React.CSSProperties = { backgroundColor: "#0F1512" };
    let centreContent: React.ReactNode = null;
    let holeNumberColour = "text-ink-500";
    let parColour = "text-ink-600";
    let borderClass = "border-ink-800";

    if (played && state) {
      if (state.delta === 0) {
        // All square — dark grey block, "AS" label
        fillStyle = { backgroundColor: "#2A3831" };
        centreContent = (
          <div className="font-mono tabular text-sm md:text-base font-medium text-ink-200">
            AS
          </div>
        );
      } else if (state.delta > 0) {
        // Team A leading at this point
        fillStyle = { backgroundColor: teamA.colour };
        holeNumberColour = "text-white/60";
        parColour = "text-white/40";
        centreContent = (
          <div className="font-mono tabular text-sm md:text-base font-semibold text-white leading-none">
            {state.delta}↑
          </div>
        );
      } else {
        // Team B leading
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
        className={`relative aspect-square flex items-center justify-center rounded-sm border ${borderClass}`}
        style={fillStyle}
      >
        <div
          className={`absolute top-1 left-1 text-[10px] font-mono tabular leading-none ${holeNumberColour}`}
        >
          {holeNumber}
        </div>
        {hole && (
          <div className={`absolute top-1 right-1 text-[9px] leading-none ${parColour}`}>
            P{hole.par}
          </div>
        )}
        {centreContent}
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

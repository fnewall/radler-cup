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

// Formats where both partners share strokes (one ball, alternate or one-of-best
// shot). For these, the pair shows as a single pip with the team display code.
const SHARED_PAIR_FORMATS = new Set([
  "foursomes",
  "greensomes",
  "scramble_2v2",
]);

// Formats where each individual player has their own strokes. We always show
// one pip per player so it's obvious who's getting the shot.
const INDIVIDUAL_FORMATS = new Set(["betterball", "singles"]);

// Take a first initial (or first two if names collide later — left as a TODO).
function initialOf(name: string): string {
  const cleaned = (name || "?").trim();
  if (!cleaned) return "?";
  return cleaned[0].toUpperCase();
}

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
  const sharedPair = SHARED_PAIR_FORMATS.has(format);
  const individual = INDIVIDUAL_FORMATS.has(format);

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

  function pipsForTeam(
    team: { display_code: string; players: PlayerLite[] },
    hole: number
  ): Pip[] {
    // Build raw per-player counts for this hole
    const perPlayer = team.players.map((p) => ({
      player: p,
      count: perHoleStrokes[p.id]?.[hole] ?? 0,
    }));

    if (sharedPair) {
      // Foursomes / greensomes / scramble — collapse to ONE pip showing the
      // team display code. We take the max stroke count across the pair
      // (they share strokes in these formats, so the values should match).
      const maxCount = perPlayer.reduce((m, x) => Math.max(m, x.count), 0);
      if (maxCount <= 0) return [];
      return [{ label: team.display_code, count: maxCount }];
    }

    if (individual) {
      // Betterball / singles — show one pip PER player who receives shots,
      // labelled with their first initial so it's obvious who.
      return perPlayer
        .filter((x) => x.count > 0)
        .map((x) => ({
          label: initialOf(x.player.display_name),
          count: x.count,
        }));
    }

    // Fallback (unknown format): collapse to team code
    const maxCount = perPlayer.reduce((m, x) => Math.max(m, x.count), 0);
    if (maxCount <= 0) return [];
    return [{ label: team.display_code, count: maxCount }];
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

        {/* Per-team shot pips. Left half = team A, right half = team B. */}
        {hasShots && (
          <div className="absolute bottom-0 left-0 right-0 flex pointer-events-none">
            <div className="flex-1 flex items-end justify-start gap-px pl-0.5 pb-0.5 flex-wrap">
              {pipsA.map((p, i) => (
                <ShotPip key={`a-${i}`} pip={p} />
              ))}
            </div>
            <div className="flex-1 flex items-end justify-end gap-px pr-0.5 pb-0.5 flex-wrap">
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

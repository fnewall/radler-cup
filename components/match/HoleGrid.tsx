"use client";

import Link from "next/link";
import type { HoleOutcome } from "@/lib/scoring/evaluate";

type Props = {
  matchId: string;
  holes: Array<{ hole_number: number; par: number; stroke_index: number }>;
  outcomes: HoleOutcome[];
  teamA: { display_code: string; colour: string; tint: string };
  teamB: { display_code: string; colour: string; tint: string };
  currentHole: number | null;
  canEdit: boolean;
};

export function HoleGrid({
  matchId,
  holes,
  outcomes,
  teamA,
  teamB,
  currentHole,
  canEdit,
}: Props) {
  function outcomeForHole(n: number): HoleOutcome | undefined {
    return outcomes.find((o) => o.hole_number === n);
  }

  function renderCell(holeNumber: number) {
    const outcome = outcomeForHole(holeNumber);
    const hole = holes.find((h) => h.hole_number === holeNumber);
    const isCurrent = currentHole === holeNumber;
    const played = !!outcome && hasResult(outcome.result);

    let bg = "bg-ink-950";
    let border = "border-ink-800";
    let letter = "";
    let letterColour = "";

    if (played && outcome) {
      if (outcome.result === "team_a" || outcome.result === "conceded_to_a") {
        bg = "";
        letter = outcome.is_conceded ? "—" : teamA.display_code;
        letterColour = teamA.colour;
      } else if (outcome.result === "team_b" || outcome.result === "conceded_to_b") {
        bg = "";
        letter = outcome.is_conceded ? "—" : teamB.display_code;
        letterColour = teamB.colour;
      } else if (outcome.result === "halved") {
        bg = "bg-ink-800";
        letter = "½";
        letterColour = "#B8C4BE";
      }
    }

    if (isCurrent) {
      border = "border-schloss-bright";
    }

    const cellStyle: React.CSSProperties = played && outcome
      ? outcome.result === "team_a" || outcome.result === "conceded_to_a"
        ? { backgroundColor: teamA.tint }
        : outcome.result === "team_b" || outcome.result === "conceded_to_b"
          ? { backgroundColor: teamB.tint }
          : {}
      : {};

    const content = (
      <div
        className={`relative aspect-square flex items-center justify-center rounded-sm border ${bg} ${border} ${
          isCurrent ? "border-2 ring-1 ring-schloss-bright/30" : ""
        }`}
        style={cellStyle}
      >
        {/* Hole number top-left */}
        <div className="absolute top-1 left-1 text-[10px] font-mono tabular text-ink-500 leading-none">
          {holeNumber}
        </div>

        {/* Par top-right */}
        {hole && (
          <div className="absolute top-1 right-1 text-[9px] text-ink-600 leading-none">
            P{hole.par}
          </div>
        )}

        {/* Centre content */}
        {played && letter ? (
          <div
            className="font-mono tabular text-xl md:text-2xl font-light"
            style={{ color: letterColour }}
          >
            {letter}
          </div>
        ) : isCurrent ? (
          <div className="text-[9px] uppercase tracking-widest text-schloss-bright">
            now
          </div>
        ) : null}
      </div>
    );

    // Played holes editable (tap to edit), unplayed non-current also tappable (enter directly)
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

function hasResult(
  r: HoleOutcome["result"] | undefined
): r is HoleOutcome["result"] {
  return (
    r === "team_a" ||
    r === "team_b" ||
    r === "halved" ||
    r === "conceded_to_a" ||
    r === "conceded_to_b"
  );
}

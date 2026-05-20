import type { Hole } from "@/lib/scoring/strokes";

type Player = {
  id: string;
  display_name: string;
  handicap: number | null;
};

type Side = {
  team_name: string;
  team_display_code: string;
  team_colour: string;
  players: Player[];
};

type Props = {
  format: "foursomes" | "betterball" | "greensomes" | "scramble_2v2" | "singles";
  teamA: Side;
  teamB: Side;
  holes: Hole[];
  perHoleStrokes: Record<string, Record<number, number>>;
  maxStrokesPerHole: number | null;
};

type StrokeEntry = {
  label: string;
  subtitle: string;
  colour: string;
  strokes: Record<number, number>;
  total: number;
};

function mapsEqual(
  a: Record<number, number>,
  b: Record<number, number>,
  holes: Hole[]
): boolean {
  for (const h of holes) {
    if ((a[h.hole_number] ?? 0) !== (b[h.hole_number] ?? 0)) return false;
  }
  return true;
}

function buildEntries(
  side: Side,
  format: Props["format"],
  perHoleStrokes: Record<string, Record<number, number>>,
  holes: Hole[]
): StrokeEntry[] {
  const isPair =
    format === "foursomes" ||
    format === "greensomes" ||
    format === "scramble_2v2";

  // Collapse to pair entry if pair format and all players share the same stroke map
  if (isPair && side.players.length > 1) {
    const first = perHoleStrokes[side.players[0].id] ?? {};
    const allShare = side.players.every((p) =>
      mapsEqual(perHoleStrokes[p.id] ?? {}, first, holes)
    );
    if (allShare) {
      const total = Object.values(first).reduce((s, n) => s + n, 0);
      return [
        {
          label: `${side.team_display_code} pair`,
          subtitle: side.players
            .map(
              (p) =>
                `${p.display_name}${p.handicap !== null ? ` (${p.handicap})` : ""}`
            )
            .join(" & "),
          colour: side.team_colour,
          strokes: first,
          total,
        },
      ];
    }
  }

  // Otherwise one entry per player
  return side.players.map((p) => {
    const strokes = perHoleStrokes[p.id] ?? {};
    const total = Object.values(strokes).reduce((s, n) => s + n, 0);
    return {
      label: p.display_name,
      subtitle:
        p.handicap !== null
          ? `${side.team_display_code} · HCP ${p.handicap}`
          : side.team_display_code,
      colour: side.team_colour,
      strokes,
      total,
    };
  });
}

export function StrokeAllocation({
  format,
  teamA,
  teamB,
  holes,
  perHoleStrokes,
  maxStrokesPerHole,
}: Props) {
  const entriesA = buildEntries(teamA, format, perHoleStrokes, holes);
  const entriesB = buildEntries(teamB, format, perHoleStrokes, holes);

  // Hide entirely if no one is receiving any shots in this match
  const anyShots = [...entriesA, ...entriesB].some((e) => e.total > 0);
  if (!anyShots) return null;

  return (
    <section className="border border-shot-accent/20 rounded-lg bg-shot-bg/15 p-4 md:p-5">
      <div className="flex items-baseline justify-between mb-4">
        <div className="text-eyebrow uppercase text-shot-accent">
          Handicap shots
        </div>
        <div className="text-[10px] uppercase tracking-[0.15em] text-ink-500">
          {maxStrokesPerHole === 1 ? "Max 1 per hole" : "Strokes can stack"}
        </div>
      </div>

      <div className="space-y-4">
        <SidePanel side={teamA} entries={entriesA} holes={holes} />
        <div className="hairline" />
        <SidePanel side={teamB} entries={entriesB} holes={holes} />
      </div>
    </section>
  );
}

function SidePanel({
  side,
  entries,
  holes,
}: {
  side: Side;
  entries: StrokeEntry[];
  holes: Hole[];
}) {
  return (
    <div className="space-y-3">
      <div
        className="text-eyebrow uppercase"
        style={{ color: side.team_colour }}
      >
        {side.team_name}
      </div>
      {entries.map((e) => (
        <EntryRow key={e.label} entry={e} holes={holes} />
      ))}
    </div>
  );
}

function EntryRow({ entry, holes }: { entry: StrokeEntry; holes: Hole[] }) {
  const noShots = entry.total === 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <div className="min-w-0 flex-1">
          <div
            className="font-display text-base md:text-lg text-ink-100 leading-tight truncate"
            style={{ color: entry.colour }}
          >
            {entry.label}
          </div>
          <div className="text-[11px] text-ink-400 truncate">
            {entry.subtitle}
          </div>
        </div>
        <div
          className={`font-mono tabular text-sm font-medium shrink-0 ${
            noShots ? "text-ink-500" : "text-shot-accent"
          }`}
        >
          {noShots
            ? "no shots"
            : `${entry.total} shot${entry.total === 1 ? "" : "s"}`}
        </div>
      </div>

      <MiniScorecard strokes={entry.strokes} holes={holes} />
    </div>
  );
}

function MiniScorecard({
  strokes,
  holes,
}: {
  strokes: Record<number, number>;
  holes: Hole[];
}) {
  function getSI(h: number): number | undefined {
    return holes.find((x) => x.hole_number === h)?.stroke_index;
  }

  return (
    <div className="space-y-0.5">
      <div className="grid grid-cols-9 gap-0.5">
        {Array.from({ length: 9 }, (_, i) => i + 1).map((h) => (
          <MiniCell
            key={h}
            hole={h}
            strokes={strokes[h] ?? 0}
            si={getSI(h)}
          />
        ))}
      </div>
      <div className="grid grid-cols-9 gap-0.5">
        {Array.from({ length: 9 }, (_, i) => i + 10).map((h) => (
          <MiniCell
            key={h}
            hole={h}
            strokes={strokes[h] ?? 0}
            si={getSI(h)}
          />
        ))}
      </div>
    </div>
  );
}

function MiniCell({
  hole,
  strokes,
  si,
}: {
  hole: number;
  strokes: number;
  si: number | undefined;
}) {
  if (strokes === 0) {
    return (
      <div className="aspect-[1/1] flex items-center justify-center bg-ink-900/60 border border-ink-800/60 rounded-sm">
        <span className="text-[10px] font-mono tabular text-ink-500">
          {hole}
        </span>
      </div>
    );
  }
  return (
    <div className="aspect-[1/1] flex flex-col items-center justify-center bg-shot-accent text-shot-bg rounded-sm relative">
      <span className="text-[10px] font-mono tabular font-semibold leading-none">
        {hole}
      </span>
      {strokes > 1 && (
        <span className="absolute top-0.5 right-0.5 text-[8px] font-bold leading-none">
          ×{strokes}
        </span>
      )}
      {si !== undefined && (
        <span className="text-[7px] uppercase font-medium leading-none mt-0.5 opacity-70">
          si{si}
        </span>
      )}
    </div>
  );
}

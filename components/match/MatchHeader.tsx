import type { ComputedAllowance } from "@/lib/scoring/allowance";

type Props = {
  teamA: {
    team_id: string;
    team_name: string;
    team_display_code: string;
    team_colour: string;
    players: Array<{ id: string; display_name: string; handicap: number | null; slot: number }>;
  };
  teamB: {
    team_id: string;
    team_name: string;
    team_display_code: string;
    team_colour: string;
    players: Array<{ id: string; display_name: string; handicap: number | null; slot: number }>;
  };
  statusText: string;
  complete: boolean;
  allowance: ComputedAllowance;
};

export function MatchHeader({ teamA, teamB, statusText, complete, allowance }: Props) {
  return (
    <div>
      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 md:gap-6 items-center">
        <Side
          side={teamA}
          align="right"
          allowance={allowance}
          isWeaker={allowance.weakerSide === "team_a"}
        />
        <div className="text-eyebrow uppercase text-ink-600">vs</div>
        <Side
          side={teamB}
          align="left"
          allowance={allowance}
          isWeaker={allowance.weakerSide === "team_b"}
        />
      </div>

      <div className="mt-6 pt-6 border-t border-ink-800 text-center">
        <div className="text-eyebrow uppercase text-ink-500 mb-2">
          {complete ? "Final" : "Live"}
        </div>
        <div className="font-display text-2xl md:text-3xl text-ink-100">
          {statusText}
        </div>
      </div>
    </div>
  );
}

function Side({
  side,
  align,
  allowance,
  isWeaker,
}: {
  side: Props["teamA"];
  align: "left" | "right";
  allowance: ComputedAllowance;
  isWeaker: boolean;
}) {
  // Pair allowance: show one +N next to the pair, not per player.
  // Use any weaker-side player's strokes value (they should be equal).
  const pairStrokes = (() => {
    if (allowance.scope !== "pair") return null;
    if (!isWeaker) return 0;
    const firstPlayer = side.players[0];
    if (!firstPlayer) return 0;
    return allowance.strokesByPlayer[firstPlayer.id] ?? 0;
  })();

  return (
    <div
      className={`flex flex-col ${
        align === "right" ? "items-end text-right" : "items-start text-left"
      }`}
    >
      <div
        className="text-eyebrow uppercase mb-2 flex items-baseline gap-2"
        style={{ color: side.team_colour }}
      >
        <span>{side.team_display_code} · {side.team_name}</span>
      </div>

      <div className="flex flex-col gap-1">
        {side.players.map((p) => {
          const individualStrokes =
            allowance.scope === "individual"
              ? allowance.strokesByPlayer[p.id] ?? 0
              : null;
          return (
            <div
              key={p.id}
              className={`text-sm md:text-base text-ink-100 leading-tight flex items-baseline gap-2 ${
                align === "right" ? "flex-row-reverse" : ""
              }`}
            >
              <span className="font-medium">{p.display_name}</span>
              <span className="font-mono tabular text-xs text-ink-500 inline-flex items-baseline gap-1.5">
                <span>{p.handicap !== null ? p.handicap : "—"}</span>
                {individualStrokes !== null && individualStrokes > 0 && (
                  <span className="text-schloss-bright">+{individualStrokes}</span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {pairStrokes !== null && (
        <div
          className={`mt-2 text-xs flex items-baseline gap-2 ${
            align === "right" ? "flex-row-reverse" : ""
          }`}
        >
          <span className="text-eyebrow uppercase text-ink-500">Pair</span>
          {pairStrokes > 0 ? (
            <span className="font-mono tabular text-schloss-bright">
              +{pairStrokes}
            </span>
          ) : (
            <span className="font-mono tabular text-ink-600">—</span>
          )}
        </div>
      )}
    </div>
  );
}

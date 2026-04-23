type Props = {
  teamA: {
    team_name: string;
    team_display_code: string;
    team_colour: string;
    players: Array<{ id: string; display_name: string; handicap: number | null; slot: number }>;
  };
  teamB: {
    team_name: string;
    team_display_code: string;
    team_colour: string;
    players: Array<{ id: string; display_name: string; handicap: number | null; slot: number }>;
  };
  statusText: string;
  complete: boolean;
  strokesPerPlayer: Record<string, number>;
};

export function MatchHeader({ teamA, teamB, statusText, complete, strokesPerPlayer }: Props) {
  return (
    <div>
      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 md:gap-6 items-center">
        <Side side={teamA} align="right" strokes={strokesPerPlayer} />
        <div className="text-eyebrow uppercase text-ink-600">vs</div>
        <Side side={teamB} align="left" strokes={strokesPerPlayer} />
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
  strokes,
}: {
  side: Props["teamA"];
  align: "left" | "right";
  strokes: Record<string, number>;
}) {
  return (
    <div
      className={`flex flex-col ${
        align === "right" ? "items-end text-right" : "items-start text-left"
      }`}
    >
      <div
        className="text-eyebrow uppercase mb-2"
        style={{ color: side.team_colour }}
      >
        {side.team_display_code} · {side.team_name}
      </div>
      <div className="flex flex-col gap-1">
        {side.players.map((p) => {
          const s = strokes[p.id];
          return (
            <div
              key={p.id}
              className={`text-sm md:text-base text-ink-100 leading-tight flex items-baseline gap-2 ${
                align === "right" ? "flex-row-reverse" : ""
              }`}
            >
              <span className="font-medium">{p.display_name}</span>
              <span className="font-mono tabular text-xs text-ink-500">
                {p.handicap !== null ? p.handicap : "—"}
                {s !== undefined && s > 0 && (
                  <span className="text-schloss-bright ml-1.5">
                    +{s}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface TeamCrestProps {
  team: "sandbaggers" | "tbc";
  name: string;
  captain: string;
  players: number;
  handicapTotal: number;
  align?: "left" | "right";
}

export function TeamCrest({
  team,
  name,
  captain,
  players,
  handicapTotal,
  align = "left",
}: TeamCrestProps) {
  const accent = team === "sandbaggers" ? "sandbaggers" : "tbc";
  const isRight = align === "right";

  return (
    <div
      className={`flex flex-col ${
        isRight ? "items-end text-right" : "items-start text-left"
      }`}
    >
      <div
        className={`text-eyebrow uppercase mb-3 ${
          team === "sandbaggers" ? "text-sandbaggers" : "text-tbc"
        }`}
      >
        {team === "sandbaggers" ? "Blue Team" : "Red Team"}
      </div>

      <h2 className="font-display text-5xl md:text-7xl font-light leading-[0.9] tracking-tight text-ink-100">
        {name}
      </h2>

      <div className={`mt-6 flex flex-col gap-2 ${isRight ? "items-end" : "items-start"}`}>
        <div className="flex items-center gap-2 text-sm text-ink-300">
          <span className="text-eyebrow text-ink-500 uppercase">Captain</span>
          <span className="font-medium text-ink-100">{captain}</span>
        </div>
        <div className="flex items-center gap-4 mt-1">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono tabular text-xl text-ink-100">{players}</span>
            <span className="text-eyebrow text-ink-500 uppercase">Players</span>
          </div>
          <div className={`w-px h-3 bg-ink-700`} />
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono tabular text-xl text-ink-100">{handicapTotal}</span>
            <span className="text-eyebrow text-ink-500 uppercase">HCP</span>
          </div>
        </div>
      </div>

      <div
        className={`mt-6 h-[2px] w-16 bg-${accent} opacity-80`}
        style={{
          background: team === "sandbaggers" ? "#3B8BE8" : "#E24B4A",
        }}
      />
    </div>
  );
}

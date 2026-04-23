import type { HoleOutcome } from "@/lib/scoring/evaluate";

type Props = {
  outcomes: HoleOutcome[];
  teamA: { display_code: string; colour: string };
  teamB: { display_code: string; colour: string };
};

export function HoleSummary({ outcomes, teamA, teamB }: Props) {
  const scored = outcomes.filter(
    (o) =>
      o.team_a_net !== null ||
      o.team_b_net !== null ||
      o.is_conceded
  );

  if (scored.length === 0) {
    return (
      <div className="bg-ink-950 border border-ink-800 rounded-sm p-6 text-center text-sm text-ink-500">
        No holes played yet.
      </div>
    );
  }

  // Running match delta
  let delta = 0;

  const rows = scored.map((o) => {
    if (o.result === "team_a" || o.result === "conceded_to_a") delta += 1;
    else if (o.result === "team_b" || o.result === "conceded_to_b") delta -= 1;

    let winnerCode: string | null = null;
    let winnerColour: string | null = null;
    let conceded = false;
    if (o.result === "team_a" || o.result === "conceded_to_a") {
      winnerCode = teamA.display_code;
      winnerColour = teamA.colour;
      conceded = o.is_conceded;
    } else if (o.result === "team_b" || o.result === "conceded_to_b") {
      winnerCode = teamB.display_code;
      winnerColour = teamB.colour;
      conceded = o.is_conceded;
    }

    let statusText: string;
    let statusColour: string;
    if (delta === 0) {
      statusText = "AS";
      statusColour = "text-ink-400";
    } else if (delta > 0) {
      statusText = `${delta} UP`;
      statusColour = "";
    } else {
      statusText = `${Math.abs(delta)} UP`;
      statusColour = "";
    }
    const statusColourStyle =
      delta === 0 ? undefined : { color: delta > 0 ? teamA.colour : teamB.colour };

    return {
      hole: o.hole_number,
      par: o.par,
      team_a_net: o.team_a_net,
      team_b_net: o.team_b_net,
      winnerCode,
      winnerColour,
      conceded,
      halved: o.result === "halved",
      statusText,
      statusColour,
      statusColourStyle,
    };
  });

  // Grid: [Hole] [Par] [TeamA net] [TeamB net] [Winner] [Status]
  // Equal widths for the two net columns to mirror each other cleanly.
  return (
    <div className="bg-ink-950 border border-ink-800 rounded-sm overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[48px_48px_1fr_1fr_64px_72px] items-center gap-2 px-5 py-3 border-b border-ink-800">
        <div className="text-eyebrow uppercase text-ink-500">Hole</div>
        <div className="text-eyebrow uppercase text-ink-500">Par</div>
        <div
          className="text-eyebrow uppercase text-center"
          style={{ color: teamA.colour }}
        >
          {teamA.display_code}
        </div>
        <div
          className="text-eyebrow uppercase text-center"
          style={{ color: teamB.colour }}
        >
          {teamB.display_code}
        </div>
        <div className="text-eyebrow uppercase text-ink-500 text-center">Won</div>
        <div className="text-eyebrow uppercase text-ink-500 text-right">Status</div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-ink-800">
        {rows.map((r) => (
          <div
            key={r.hole}
            className="grid grid-cols-[48px_48px_1fr_1fr_64px_72px] items-center gap-2 px-5 py-3 text-sm"
          >
            <div className="font-mono tabular text-ink-300">{r.hole}</div>
            <div className="font-mono tabular text-ink-500">{r.par}</div>
            <div className="font-mono tabular text-ink-100 text-center">
              {r.team_a_net !== null ? r.team_a_net : r.conceded ? "—" : ""}
            </div>
            <div className="font-mono tabular text-ink-100 text-center">
              {r.team_b_net !== null ? r.team_b_net : r.conceded ? "—" : ""}
            </div>
            <div className="text-center">
              {r.halved ? (
                <span className="font-mono tabular text-ink-300">½</span>
              ) : r.winnerCode ? (
                <span
                  className="font-mono tabular inline-flex items-baseline gap-1"
                  style={{ color: r.winnerColour ?? undefined }}
                >
                  {r.winnerCode}
                  {r.conceded && <span className="opacity-60">·</span>}
                </span>
              ) : null}
            </div>
            <div className="text-right">
              <span
                className={`font-mono tabular ${r.statusColour}`}
                style={r.statusColourStyle}
              >
                {r.statusText}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

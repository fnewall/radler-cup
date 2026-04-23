import type { HoleOutcome } from "@/lib/scoring/evaluate";

type Props = {
  outcomes: HoleOutcome[];
  teamA: { display_code: string; colour: string };
  teamB: { display_code: string; colour: string };
};

export function HoleSummary({ outcomes, teamA, teamB }: Props) {
  const played = outcomes.filter((o) => o.result !== "halved" || o.team_a_net !== null || o.team_b_net !== null);
  // Actually — we only want to include holes that were *scored* (played).
  // Halved holes with null nets mean untouched.
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

  return (
    <div className="bg-ink-950 border border-ink-800 rounded-sm overflow-hidden">
      <div className="grid grid-cols-[auto_auto_1fr_1fr_auto] px-4 py-3 text-eyebrow uppercase text-ink-500 border-b border-ink-800 gap-3">
        <div>Hole</div>
        <div>Par</div>
        <div className="text-right" style={{ color: teamA.colour }}>
          {teamA.display_code}
        </div>
        <div className="text-right" style={{ color: teamB.colour }}>
          {teamB.display_code}
        </div>
        <div className="text-right">Hole</div>
      </div>

      <div className="divide-y divide-ink-800">
        {scored.map((o) => {
          let resultCell: React.ReactNode;
          if (o.result === "team_a" || o.result === "conceded_to_a") {
            resultCell = (
              <span
                className="font-mono tabular"
                style={{ color: teamA.colour }}
              >
                {teamA.display_code}
                {o.is_conceded ? " ·" : ""}
              </span>
            );
          } else if (o.result === "team_b" || o.result === "conceded_to_b") {
            resultCell = (
              <span
                className="font-mono tabular"
                style={{ color: teamB.colour }}
              >
                {teamB.display_code}
                {o.is_conceded ? " ·" : ""}
              </span>
            );
          } else {
            resultCell = <span className="font-mono tabular text-ink-300">½</span>;
          }

          return (
            <div
              key={o.hole_number}
              className="grid grid-cols-[auto_auto_1fr_1fr_auto] px-4 py-2 gap-3 items-baseline text-sm"
            >
              <div className="font-mono tabular text-ink-400 w-6">
                {o.hole_number}
              </div>
              <div className="font-mono tabular text-ink-500 w-6">{o.par}</div>
              <div className="text-right font-mono tabular text-ink-100">
                {o.team_a_net !== null ? o.team_a_net : o.is_conceded ? "—" : ""}
              </div>
              <div className="text-right font-mono tabular text-ink-100">
                {o.team_b_net !== null ? o.team_b_net : o.is_conceded ? "—" : ""}
              </div>
              <div className="text-right min-w-[40px]">{resultCell}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

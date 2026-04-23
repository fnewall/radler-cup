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

  // Running match status (team_a positive = team_a up)
  let delta = 0;

  return (
    <div className="bg-ink-950 border border-ink-800 rounded-sm overflow-hidden">
      <div className="grid grid-cols-[auto_auto_1fr_1fr_auto_auto] px-4 py-3 text-eyebrow uppercase text-ink-500 border-b border-ink-800 gap-3">
        <div>Hole</div>
        <div>Par</div>
        <div className="text-right" style={{ color: teamA.colour }}>
          {teamA.display_code}
        </div>
        <div className="text-right" style={{ color: teamB.colour }}>
          {teamB.display_code}
        </div>
        <div className="text-right">Hole</div>
        <div className="text-right min-w-[52px]">Status</div>
      </div>

      <div className="divide-y divide-ink-800">
        {scored.map((o) => {
          // Update running delta for this hole
          if (o.result === "team_a" || o.result === "conceded_to_a") {
            delta += 1;
          } else if (o.result === "team_b" || o.result === "conceded_to_b") {
            delta -= 1;
          }
          // halved: no change

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

          // Status cell
          let statusCell: React.ReactNode;
          if (delta === 0) {
            statusCell = (
              <span className="font-mono tabular text-ink-400 text-sm">AS</span>
            );
          } else if (delta > 0) {
            statusCell = (
              <span
                className="font-mono tabular text-sm"
                style={{ color: teamA.colour }}
              >
                {delta} UP
              </span>
            );
          } else {
            statusCell = (
              <span
                className="font-mono tabular text-sm"
                style={{ color: teamB.colour }}
              >
                {Math.abs(delta)} UP
              </span>
            );
          }

          return (
            <div
              key={o.hole_number}
              className="grid grid-cols-[auto_auto_1fr_1fr_auto_auto] px-4 py-2 gap-3 items-baseline text-sm"
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
              <div className="text-right min-w-[52px]">{statusCell}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

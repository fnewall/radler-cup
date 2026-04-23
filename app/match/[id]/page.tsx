import Link from "next/link";
import { notFound } from "next/navigation";
import { getMatchDetail } from "@/lib/queries/match";
import { GearButton } from "@/components/GearButton";
import { HoleGrid } from "@/components/match/HoleGrid";
import { MatchHeader } from "@/components/match/MatchHeader";
import { HoleSummary } from "@/components/match/HoleSummary";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const FORMAT_LABELS: Record<string, string> = {
  foursomes: "Foursomes",
  betterball: "Betterball",
  greensomes: "Greensomes",
  scramble_2v2: "Scramble",
  singles: "Singles",
};

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getMatchDetail(id);
  if (!data) notFound();

  const authSession = await getSession();
  const canEdit =
    authSession?.role === "player" ||
    authSession?.role === "captain" ||
    authSession?.role === "admin";

  const {
    session: sess,
    match,
    teamA,
    teamB,
    holes,
    holeScores,
    evaluation,
    statusText,
    allowance,
  } = data;

  const playedHoleNumbers = new Set(holeScores.map((r) => r.hole_number));

  // Current hole = first unplayed, null if all 18 played or match complete.
  let currentHole: number | null = null;
  for (let i = 1; i <= 18; i++) {
    if (!playedHoleNumbers.has(i)) {
      currentHole = i;
      break;
    }
  }
  if (evaluation.complete) currentHole = null;

  return (
    <main className="min-h-screen bg-radial-schloss texture-noise">
      <header className="flex items-center justify-between px-6 md:px-10 py-6">
        <Link
          href={`/session/${sess.id}`}
          className="text-eyebrow uppercase text-ink-400 hover:text-ink-100 transition-colors"
        >
          ← {sess.label}
        </Link>
        <GearButton />
      </header>

      <section className="px-6 md:px-10 pt-4 pb-6 max-w-3xl mx-auto">
        <div className="text-eyebrow uppercase text-schloss-bright mb-2">
          Match {match.match_order} of {sess.match_count} · {FORMAT_LABELS[sess.format]}
        </div>
      </section>

      <section className="px-6 md:px-10 pb-8 max-w-3xl mx-auto">
        <MatchHeader
          teamA={teamA}
          teamB={teamB}
          statusText={statusText}
          complete={evaluation.complete}
          allowance={allowance}
        />
      </section>

      <section className="px-6 md:px-10 pb-8 max-w-3xl mx-auto">
        <div className="flex items-baseline justify-between mb-4">
          <div className="text-eyebrow uppercase text-schloss-bright">
            Holes
          </div>
          {!evaluation.complete && currentHole && canEdit && (
            <Link
              href={`/match/${match.id}/hole/${currentHole}`}
              className="h-10 px-4 rounded-md bg-schloss text-white hover:bg-schloss-bright transition-colors text-sm font-medium inline-flex items-center"
            >
              Enter hole {currentHole} →
            </Link>
          )}
        </div>

        <HoleGrid
          matchId={match.id}
          holes={holes}
          outcomes={evaluation.outcomes}
          playedHoleNumbers={playedHoleNumbers}
          teamA={{
            display_code: teamA.team_display_code,
            colour: teamA.team_colour,
            tint: hexTint(teamA.team_colour, 0.12),
          }}
          teamB={{
            display_code: teamB.team_display_code,
            colour: teamB.team_colour,
            tint: hexTint(teamB.team_colour, 0.12),
          }}
          currentHole={currentHole}
          canEdit={canEdit}
        />

        {!canEdit && currentHole && (
          <p className="mt-4 text-xs text-ink-500 text-center">
            Sign in as a player via the gear icon to enter scores.
          </p>
        )}
      </section>

      <section className="px-6 md:px-10 pb-20 max-w-3xl mx-auto">
        <div className="text-eyebrow uppercase text-schloss-bright mb-4">
          Summary
        </div>
        <HoleSummary
          outcomes={evaluation.outcomes}
          teamA={{
            display_code: teamA.team_display_code,
            colour: teamA.team_colour,
          }}
          teamB={{
            display_code: teamB.team_display_code,
            colour: teamB.team_colour,
          }}
        />
      </section>
    </main>
  );
}

function hexTint(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

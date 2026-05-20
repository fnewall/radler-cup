import Link from "next/link";
import { notFound } from "next/navigation";
import { getMatchDetail } from "@/lib/queries/match";
import { GearButton } from "@/components/GearButton";
import { HoleGrid } from "@/components/match/HoleGrid";
import { MatchHeader } from "@/components/match/MatchHeader";
import { HoleSummary } from "@/components/match/HoleSummary";
import { StrokeAllocation } from "@/components/match/StrokeAllocation";
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
    tournament,
    session: sess,
    match,
    teamA,
    teamB,
    holes,
    holeScores,
    evaluation,
    statusText,
    allowance,
    perHoleStrokes,
  } = data;

  const playedHoleNumbers = new Set(holeScores.map((r) => r.hole_number));

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

      {/* SHOTS — clear summary, above the grid */}
      <section className="px-6 md:px-10 pb-6 max-w-3xl mx-auto">
        <StrokeAllocation
          format={sess.format}
          teamA={teamA}
          teamB={teamB}
          holes={holes}
          perHoleStrokes={perHoleStrokes}
          maxStrokesPerHole={tournament.max_strokes_per_hole}
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
          format={sess.format}
          holes={holes}
          outcomes={evaluation.outcomes}
          playedHoleNumbers={playedHoleNumbers}
          teamA={{
            display_code: teamA.team_display_code,
            colour: teamA.team_colour,
            players: teamA.players.map((p) => ({
              id: p.id,
              display_name: p.display_name,
            })),
          }}
          teamB={{
            display_code: teamB.team_display_code,
            colour: teamB.team_colour,
            players: teamB.players.map((p) => ({
              id: p.id,
              display_name: p.display_name,
            })),
          }}
          perHoleStrokes={perHoleStrokes}
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

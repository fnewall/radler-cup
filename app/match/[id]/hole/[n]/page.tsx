import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getHoleEntryContext } from "@/lib/queries/holeEntry";
import { getSession } from "@/lib/auth/session";
import { HoleEntry } from "@/components/match/HoleEntry";

export const dynamic = "force-dynamic";

const FORMAT_LABELS: Record<string, string> = {
  foursomes: "Foursomes",
  betterball: "Betterball",
  greensomes: "Greensomes",
  scramble_2v2: "Scramble",
  singles: "Singles",
};

export default async function HoleEntryPage({
  params,
}: {
  params: Promise<{ id: string; n: string }>;
}) {
  const { id, n } = await params;
  const holeNumber = parseInt(n, 10);
  if (!holeNumber || holeNumber < 1 || holeNumber > 18) notFound();

  const authSession = await getSession();
  if (!authSession) {
    redirect(`/match/${id}`);
  }

  const ctx = await getHoleEntryContext(id, holeNumber);
  if (!ctx) notFound();

  return (
    <main className="min-h-screen bg-radial-schloss texture-noise">
      <header className="flex items-center justify-between px-6 md:px-10 py-4">
        <Link
          href={`/match/${ctx.match.id}`}
          className="text-eyebrow uppercase text-ink-400 hover:text-ink-100 transition-colors"
        >
          ← Match {ctx.match.match_order}
        </Link>
        <div className="flex items-center gap-3">
          {ctx.navigation.prev_hole !== null && (
            <Link
              href={`/match/${ctx.match.id}/hole/${ctx.navigation.prev_hole}`}
              className="text-eyebrow uppercase text-ink-400 hover:text-ink-100 transition-colors"
            >
              ← {ctx.navigation.prev_hole}
            </Link>
          )}
          {ctx.navigation.next_hole !== null && (
            <Link
              href={`/match/${ctx.match.id}/hole/${ctx.navigation.next_hole}`}
              className="text-eyebrow uppercase text-ink-400 hover:text-ink-100 transition-colors"
            >
              {ctx.navigation.next_hole} →
            </Link>
          )}
        </div>
      </header>

      <section className="px-6 md:px-10 pt-4 pb-6 max-w-2xl mx-auto">
        <div className="text-eyebrow uppercase text-schloss-bright mb-2">
          {ctx.session.label} · {FORMAT_LABELS[ctx.session.format]}
        </div>

        <div className="flex items-baseline gap-4 mb-2">
          <h1 className="font-display text-hero text-ink-100 leading-[0.9]">
            Hole {ctx.hole.number}
          </h1>
        </div>

        <div className="flex items-baseline gap-4 text-ink-400 text-sm flex-wrap">
          <span>
            Par <span className="font-mono tabular text-ink-200">{ctx.hole.par}</span>
          </span>
          <span>
            SI <span className="font-mono tabular text-ink-200">{ctx.hole.stroke_index}</span>
          </span>
          {ctx.hole.yardage !== null && (
            <span>
              <span className="font-mono tabular text-ink-200">{ctx.hole.yardage}</span> m
            </span>
          )}
        </div>
      </section>

      <section className="px-6 md:px-10 pb-24 max-w-2xl mx-auto">
        <HoleEntry
          matchId={ctx.match.id}
          holeNumber={ctx.hole.number}
          par={ctx.hole.par}
          format={ctx.session.format}
          teamA={ctx.teamA}
          teamB={ctx.teamB}
          existingScore={ctx.existingScore}
          concessionEnabled={ctx.tournament.concession_enabled}
          prevHole={ctx.navigation.prev_hole}
          nextHole={ctx.navigation.next_hole}
        />
      </section>
    </main>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getSessionPairingsContext } from "@/lib/queries/sessionPairings";
import { PairingsDrafter } from "@/components/captain/PairingsDrafter";
import { formatViennaDisplay } from "@/lib/timezone";

export const dynamic = "force-dynamic";

const FORMAT_LABELS: Record<string, string> = {
  foursomes: "Foursomes",
  betterball: "Betterball",
  greensomes: "Greensomes",
  scramble_2v2: "Scramble",
  singles: "Singles",
};

export default async function CaptainSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/");
  if (session.role !== "captain" || !session.scope) {
    redirect("/");
  }

  const { id } = await params;
  const ctx = await getSessionPairingsContext(session.scope, id);
  if (!ctx) {
    redirect("/captain");
  }

  const alreadySubmitted =
    ctx.myPairings.length > 0 &&
    ctx.myPairings.every((p) => p.submitted_at !== null);

  return (
    <main className="min-h-screen bg-radial-schloss texture-noise">
      <header className="flex items-center justify-between px-6 md:px-10 py-6">
        <Link
          href="/captain"
          className="text-eyebrow uppercase text-ink-400 hover:text-ink-100 transition-colors"
        >
          ← Captain
        </Link>
        <div className="text-eyebrow uppercase text-ink-500">
          {ctx.myTeam.name}
        </div>
      </header>

      <section className="px-6 md:px-10 pt-8 pb-32 max-w-4xl mx-auto">
        <div className="mb-10">
          <div
            className="text-eyebrow uppercase mb-3"
            style={{ color: ctx.myTeam.colour_primary }}
          >
            Session {ctx.session.session_number} ·{" "}
            {FORMAT_LABELS[ctx.session.format] ?? ctx.session.format}
          </div>
          <h1 className="font-display text-display text-ink-100 leading-[0.95] mb-3">
            {ctx.session.label}
          </h1>
          <p className="text-ink-400 text-sm">
            {formatViennaDisplay(ctx.session.start_at)} · {ctx.session.match_count} matches
          </p>
        </div>

        <PairingsDrafter
          sessionId={ctx.session.id}
          format={ctx.session.format}
          matchCount={ctx.session.match_count}
          roster={ctx.roster}
          existing={ctx.myPairings}
          alreadySubmitted={alreadySubmitted}
          pairingsRevealed={ctx.session.pairings_revealed}
          otherSubmitted={ctx.otherSubmitted}
          teamColour={ctx.myTeam.colour_primary}
        />
      </section>
    </main>
  );
}

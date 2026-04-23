import Link from "next/link";
import { notFound } from "next/navigation";
import { getMatchDetail } from "@/lib/queries/match";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function HoleEntryPage({
  params,
}: {
  params: Promise<{ id: string; n: string }>;
}) {
  const { id, n } = await params;
  const holeNumber = parseInt(n, 10);
  if (!holeNumber || holeNumber < 1 || holeNumber > 18) notFound();

  const session = await getSession();
  if (!session) {
    return (
      <main className="min-h-screen bg-radial-schloss flex items-center justify-center p-8">
        <div className="text-center space-y-3 max-w-sm">
          <div className="text-eyebrow uppercase text-tbc">Sign in required</div>
          <p className="text-sm text-ink-300">
            Enter the player PIN via the gear icon on the home page to record scores.
          </p>
          <Link
            href={`/match/${id}`}
            className="inline-block mt-4 text-sm text-schloss-bright hover:text-ink-100"
          >
            ← Back to match
          </Link>
        </div>
      </main>
    );
  }

  const data = await getMatchDetail(id);
  if (!data) notFound();

  return (
    <main className="min-h-screen bg-radial-schloss texture-noise flex items-center justify-center p-8">
      <div className="text-center space-y-4 max-w-md">
        <div className="text-eyebrow uppercase text-schloss-bright">
          Coming next
        </div>
        <h1 className="font-display text-3xl text-ink-100">
          Score entry for hole {holeNumber}
        </h1>
        <p className="text-ink-400 text-sm leading-relaxed">
          The score entry form lands in the next build step. You&apos;ll be able to enter gross scores, concede the hole, or edit a previous one from this screen.
        </p>
        <Link
          href={`/match/${data.match.id}`}
          className="inline-block mt-4 text-sm text-schloss-bright hover:text-ink-100"
        >
          ← Back to match
        </Link>
      </div>
    </main>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getCaptainContext } from "@/lib/queries/captain";
import { formatViennaDisplay } from "@/lib/timezone";

export const dynamic = "force-dynamic";

const FORMAT_LABELS: Record<string, string> = {
  foursomes: "Foursomes",
  betterball: "Betterball",
  greensomes: "Greensomes",
  scramble_2v2: "Scramble",
  singles: "Singles",
};

export default async function CaptainLanding() {
  const session = await getSession();
  if (!session) redirect("/");
  if (session.role !== "captain" || !session.scope) {
    return (
      <main className="min-h-screen bg-radial-schloss flex items-center justify-center p-8">
        <div className="text-center space-y-4 max-w-sm">
          <div className="text-eyebrow uppercase text-tbc">Restricted</div>
          <h1 className="font-display text-3xl text-ink-100">Captain access required</h1>
          <Link
            href="/"
            className="inline-block mt-4 text-sm text-schloss-bright hover:text-ink-100 transition-colors"
          >
            ← Back to home
          </Link>
        </div>
      </main>
    );
  }

  const ctx = await getCaptainContext(session.scope);
  if (!ctx) {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-radial-schloss texture-noise">
      <header className="flex items-center justify-between px-6 md:px-10 py-6">
        <div className="flex items-center gap-3">
          <div
            className="w-2 h-2 rounded-full animate-pulse-live"
            style={{ backgroundColor: ctx.team.colour_primary }}
          />
          <span className="text-eyebrow uppercase text-ink-300">
            Captain · {ctx.team.name}
          </span>
        </div>
        <Link
          href="/"
          className="text-eyebrow uppercase text-ink-400 hover:text-ink-100 transition-colors"
        >
          ← Home
        </Link>
      </header>

      <section className="px-6 md:px-10 pt-8 pb-20 max-w-4xl mx-auto">
        <div className="mb-12">
          <div
            className="text-eyebrow uppercase mb-3"
            style={{ color: ctx.team.colour_primary }}
          >
            {ctx.team.display_code} · Captain view
          </div>
          <h1 className="font-display text-hero text-ink-100 leading-[0.9] mb-4">
            {ctx.team.name}
          </h1>
          <p className="text-ink-300 text-base max-w-2xl leading-relaxed">
            Pick pairings for each upcoming session. Your submission locks once sent; both teams&apos; pairings reveal simultaneously when both captains have submitted.
          </p>
        </div>

        {ctx.upcoming.length === 0 ? (
          <div className="bg-ink-950 border border-ink-800 rounded-sm p-8 text-center">
            <div className="text-ink-300">All sessions complete.</div>
          </div>
        ) : (
          <div className="space-y-3">
            {ctx.upcoming.map((s) => {
              const formatLabel = FORMAT_LABELS[s.format] ?? s.format;
              const mine = s.my_submitted_at !== null;
              const theirs = s.other_submitted_at !== null;

              return (
                <Link
                  key={s.id}
                  href={`/captain/session/${s.id}`}
                  className="block bg-ink-950 border border-ink-800 rounded-sm p-6 hover:border-ink-700 hover:bg-ink-900 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-baseline gap-4">
                      <div
                        className="font-mono tabular text-2xl font-light"
                        style={{ color: ctx.team.colour_primary }}
                      >
                        {String(s.session_number).padStart(2, "0")}
                      </div>
                      <div>
                        <div className="text-ink-100 font-medium">
                          {s.label}
                        </div>
                        <div className="text-xs text-ink-400 mt-1">
                          {formatLabel} · {s.match_count} matches ·{" "}
                          {formatViennaDisplay(s.start_at)}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 text-right shrink-0">
                      {s.pairings_revealed ? (
                        <Pill tone="neutral">Revealed</Pill>
                      ) : mine && theirs ? (
                        <Pill tone="success">Both submitted</Pill>
                      ) : mine ? (
                        <Pill tone="success">You: submitted</Pill>
                      ) : theirs ? (
                        <Pill tone="warn">Other: submitted · your turn</Pill>
                      ) : (
                        <Pill tone="neutral">Draft</Pill>
                      )}
                      <span className="text-xs text-schloss-bright">
                        {mine ? "View →" : "Draft pairings →"}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function Pill({
  tone,
  children,
}: {
  tone: "success" | "warn" | "neutral";
  children: React.ReactNode;
}) {
  const cls =
    tone === "success"
      ? "bg-schloss-tint text-schloss-bright border-schloss"
      : tone === "warn"
        ? "bg-shot-bg text-shot-accent border-shot-border"
        : "bg-ink-900 text-ink-300 border-ink-700";
  return (
    <span
      className={`inline-block px-3 py-1 rounded-full border text-eyebrow uppercase ${cls}`}
    >
      {children}
    </span>
  );
}

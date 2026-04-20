import { Countdown } from "@/components/Countdown";
import { TeamCrest } from "@/components/TeamCrest";
import { getLandingData } from "@/lib/queries/landing";
import { GearButton } from "@/components/GearButton";

// Revalidate this page every 60s so edits via admin show up quickly
// without a rebuild, but we still get static-ish performance.
export const revalidate = 60;

// Placeholder countdown target until admin sets real start_at.
// Will be replaced by tournament.start_date + session[1].start_at.
const FALLBACK_START = "2026-06-01T09:00:00+02:00";

const FORMAT_LABELS: Record<string, string> = {
  foursomes: "Foursomes",
  betterball: "Betterball",
  greensomes: "Greensomes",
  scramble_2v2: "Scramble",
  singles: "Singles",
};

const DAY_LABELS: Record<number, string> = {
  1: "Day 1",
  2: "Day 2",
  3: "Day 3",
};

function sessionTimeLabel(s: {
  day_number: number;
  session_number: number;
  format: string;
}) {
  if (s.format === "singles") return "All day";
  // sessions 1 & 3 are mornings, 2 & 4 are afternoons
  return s.session_number % 2 === 1 ? "Morning" : "Afternoon";
}

export default async function Home() {
  const data = await getLandingData();

  if (!data) {
    return (
      <main className="min-h-screen bg-radial-schloss flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <div className="text-eyebrow uppercase text-tbc">Error</div>
          <p className="text-ink-300 text-sm">
            Could not load tournament data. Check Supabase env vars.
          </p>
        </div>
      </main>
    );
  }

  const { tournament, teams, sessions } = data;
  const [teamA, teamB] = teams;

  const countdownTarget =
    sessions[0]?.start_at ?? tournament.start_date ?? FALLBACK_START;

  const totalPoints = sessions.reduce(
    (sum, s) => sum + s.match_count * s.points_per_match,
    0
  );

  return (
    <main className="min-h-screen bg-radial-schloss texture-noise relative overflow-hidden">
      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-6 md:px-10 py-6">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-schloss-bright animate-pulse-live" />
          <span className="text-eyebrow uppercase text-ink-300">
            {tournament.name} · MMXXVI
          </span>
        </div>
        <GearButton />
      </header>

      {/* Hero */}
      <section className="relative z-10 px-6 md:px-10 pt-12 md:pt-24 pb-20 max-w-7xl mx-auto">
        <div className="text-center">
          <div className="text-eyebrow uppercase text-schloss-bright mb-6">
            Golf Club Schloss Ernegg · Austria
          </div>
          <h1 className="font-display text-hero text-ink-100 leading-[0.9]">
            The {tournament.name}
          </h1>
          <p className="mt-6 text-lg text-ink-300 max-w-xl mx-auto leading-relaxed">
            {teamA.player_count + teamB.player_count} players. Two teams. Three days of match play.
          </p>
        </div>

        <div className="mt-16 md:mt-24 flex justify-center">
          <Countdown target={countdownTarget} />
        </div>
      </section>

      <div className="relative z-10 hairline max-w-5xl mx-auto" />

      {/* Teams face-off */}
      <section className="relative z-10 px-6 md:px-10 py-20 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <div className="text-eyebrow uppercase text-ink-500 mb-3">The Tie</div>
          <h2 className="font-display text-display text-ink-100">Team versus Team</h2>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] gap-6 md:gap-16 items-center">
          <TeamCrest
            team={teamA.name === "Sandbaggers" ? "sandbaggers" : "tbc"}
            name={teamA.name}
            captain={teamA.captain?.display_name ?? "—"}
            players={teamA.player_count}
            handicapTotal={teamA.handicap_total ?? 0}
            align="right"
          />

          <div className="flex flex-col items-center gap-3">
            <div className="font-display text-3xl md:text-5xl font-light text-ink-500 italic">
              vs
            </div>
            <div className="hairline-v h-16" />
            <div className="text-eyebrow uppercase text-ink-500">
              {totalPoints} pts
            </div>
          </div>

          <TeamCrest
            team={teamB.name === "Sandbaggers" ? "sandbaggers" : "tbc"}
            name={teamB.name}
            captain={teamB.captain?.display_name ?? "—"}
            players={teamB.player_count}
            handicapTotal={teamB.handicap_total ?? 0}
            align="left"
          />
        </div>
      </section>

      <div className="relative z-10 hairline max-w-5xl mx-auto" />

      {/* Format */}
      <section className="relative z-10 px-6 md:px-10 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <div className="text-eyebrow uppercase text-ink-500 mb-3">The Format</div>
          <h2 className="font-display text-display text-ink-100">
            {sessions.length} Sessions · {totalPoints} Points
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-px bg-ink-800 border border-ink-800 rounded-sm overflow-hidden">
          {sessions.map((s) => (
            <div key={s.id} className="bg-ink-950 p-6 hover:bg-ink-900 transition-colors">
              <div className="text-eyebrow uppercase text-schloss-bright mb-4">
                Session {s.session_number}
              </div>
              <div className="text-ink-400 text-sm">
                {DAY_LABELS[s.day_number] ?? `Day ${s.day_number}`}
              </div>
              <div className="text-ink-300 text-sm mb-6">{sessionTimeLabel(s)}</div>
              <div className="font-display text-2xl text-ink-100 leading-tight">
                {FORMAT_LABELS[s.format] ?? s.format}
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-mono tabular text-2xl text-ink-100">
                  {s.match_count * s.points_per_match}
                </span>
                <span className="text-eyebrow uppercase text-ink-500">pts</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 text-center">
          <div>
            <div className="font-mono tabular text-4xl font-light text-ink-100">
              {tournament.points_to_win}
            </div>
            <div className="text-eyebrow uppercase text-ink-500 mt-2">To Win</div>
          </div>
          <div className="hairline-v h-12 hidden md:block" />
          <div>
            <div className="font-mono tabular text-4xl font-light text-ink-100">
              {tournament.points_to_tie}—{tournament.points_to_tie}
            </div>
            <div className="text-eyebrow uppercase text-ink-500 mt-2">Tie</div>
          </div>
          <div className="hairline-v h-12 hidden md:block" />
          <div>
            <div className="font-mono tabular text-4xl font-light text-ink-100">72</div>
            <div className="text-eyebrow uppercase text-ink-500 mt-2">Par</div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-6 md:px-10 py-10 max-w-7xl mx-auto">
        <div className="hairline mb-8" />
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-ink-500">
          <div className="text-eyebrow uppercase">
            Golf Club Schloss Ernegg · Niederösterreich
          </div>
          <div className="text-eyebrow uppercase">
            Live scoring · updates every second
          </div>
        </div>
      </footer>
    </main>
  );
}


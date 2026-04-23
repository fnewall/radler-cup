import Link from "next/link";
import { Countdown } from "@/components/Countdown";
import { TeamCrest } from "@/components/TeamCrest";
import { GearButton } from "@/components/GearButton";
import { LiveTournamentRefresher } from "@/components/realtime/LiveTournamentRefresher";
import { getLandingData } from "@/lib/queries/landing";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

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
  return s.session_number % 2 === 1 ? "Morning" : "Afternoon";
}

async function getTournamentTotals(
  tournamentId: string,
  teamAId: string,
  teamBId: string
): Promise<{ pointsA: number; pointsB: number; matchesStarted: boolean }> {
  const supabase = createAdminClient();
  const { data: matches } = await supabase
    .from("match")
    .select("points_team_a, points_team_b, status, session_id, session:session_id(tournament_id)")
    .not("status", "eq", "pending");

  const relevant = (matches ?? []).filter(
    (m) =>
      (m as unknown as { session: { tournament_id: string } | null }).session
        ?.tournament_id === tournamentId
  );

  let pointsA = 0;
  let pointsB = 0;
  for (const m of relevant) {
    pointsA += Number(m.points_team_a) || 0;
    pointsB += Number(m.points_team_b) || 0;
  }

  return {
    pointsA,
    pointsB,
    matchesStarted: relevant.length > 0,
  };
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

  const totals = await getTournamentTotals(tournament.id, teamA.id, teamB.id);

  const countdownTarget =
    sessions[0]?.start_at ?? tournament.start_date ?? FALLBACK_START;

  const totalPoints = sessions.reduce(
    (sum, s) => sum + s.match_count * s.points_per_match,
    0
  );

  return (
    <main className="min-h-screen bg-radial-schloss texture-noise relative overflow-hidden">
      <LiveTournamentRefresher />

      <header className="relative z-10 flex items-center justify-between px-6 md:px-10 py-6">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-schloss-bright animate-pulse-live" />
          <span className="text-eyebrow uppercase text-ink-300">
            {tournament.name} · MMXXVI
          </span>
        </div>
        <GearButton />
      </header>

      <section className="relative z-10 px-6 md:px-10 pt-12 md:pt-24 pb-12 max-w-7xl mx-auto">
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

        {/* Show big live score if matches have started, otherwise show countdown */}
        {totals.matchesStarted ? (
          <div className="mt-12 md:mt-16 max-w-4xl mx-auto">
            <div className="bg-ink-950/80 backdrop-blur border border-ink-800 rounded-sm overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_1fr] items-stretch">
                <div
                  className="py-8 md:py-12 px-6 md:px-8 flex items-center justify-end gap-4"
                  style={{
                    backgroundColor: hexTint(teamA.colour_primary ?? "#3B8BE8", 0.1),
                  }}
                >
                  <div className="text-right">
                    <div
                      className="text-eyebrow uppercase mb-2"
                      style={{ color: teamA.colour_primary }}
                    >
                      {teamA.name}
                    </div>
                    <div
                      className="font-mono tabular text-6xl md:text-7xl font-light leading-none"
                      style={{ color: teamA.colour_primary }}
                    >
                      {formatPoints(totals.pointsA)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-center px-4 md:px-6 bg-ink-900 border-x border-ink-800">
                  <div className="text-center">
                    <div className="w-2 h-2 rounded-full bg-schloss-bright animate-pulse-live mx-auto mb-2" />
                    <div className="text-eyebrow uppercase text-schloss-bright">
                      Live
                    </div>
                  </div>
                </div>

                <div
                  className="py-8 md:py-12 px-6 md:px-8 flex items-center justify-start gap-4"
                  style={{
                    backgroundColor: hexTint(teamB.colour_primary ?? "#E24B4A", 0.1),
                  }}
                >
                  <div className="text-left">
                    <div
                      className="text-eyebrow uppercase mb-2"
                      style={{ color: teamB.colour_primary }}
                    >
                      {teamB.name}
                    </div>
                    <div
                      className="font-mono tabular text-6xl md:text-7xl font-light leading-none"
                      style={{ color: teamB.colour_primary }}
                    >
                      {formatPoints(totals.pointsB)}
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-ink-900 border-t border-ink-800 px-6 py-2 text-center text-xs text-ink-500 font-mono tabular">
                {formatPoints(totals.pointsA + totals.pointsB)} of {totalPoints} points awarded · {formatPoints(tournament.points_to_win)} to win
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-16 md:mt-24 flex justify-center">
            <Countdown target={countdownTarget} />
          </div>
        )}
      </section>

      <div className="relative z-10 hairline max-w-5xl mx-auto" />

      <section className="relative z-10 px-6 md:px-10 py-20 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <div className="text-eyebrow uppercase text-ink-500 mb-3">The Tie</div>
          <h2 className="font-display text-display text-ink-100">Team versus Team</h2>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] gap-6 md:gap-16 items-center">
          <TeamCrest
            team="sandbaggers"
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
            team="tbc"
            name={teamB.name}
            captain={teamB.captain?.display_name ?? "—"}
            players={teamB.player_count}
            handicapTotal={teamB.handicap_total ?? 0}
            align="left"
          />
        </div>
      </section>

      <div className="relative z-10 hairline max-w-5xl mx-auto" />

      <section className="relative z-10 px-6 md:px-10 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <div className="text-eyebrow uppercase text-ink-500 mb-3">The Format</div>
          <h2 className="font-display text-display text-ink-100">
            {sessions.length} Sessions · {totalPoints} Points
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-px bg-ink-800 border border-ink-800 rounded-sm overflow-hidden">
          {sessions.map((s) => (
            <Link
              key={s.id}
              href={`/session/${s.id}`}
              className="bg-ink-950 p-6 hover:bg-ink-900 transition-colors block group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="text-eyebrow uppercase text-schloss-bright">
                  Session {s.session_number}
                </div>
                <SessionStatusDot session={s} />
              </div>

              <div className="text-ink-400 text-sm">
                {DAY_LABELS[s.day_number] ?? `Day ${s.day_number}`}
              </div>
              <div className="text-ink-300 text-sm mb-5">{sessionTimeLabel(s)}</div>

              <div className="font-display text-2xl text-ink-100 leading-tight">
                {FORMAT_LABELS[s.format] ?? s.format}
              </div>

              <div className="mt-4 flex items-baseline justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono tabular text-2xl text-ink-100">
                    {s.match_count * s.points_per_match}
                  </span>
                  <span className="text-eyebrow uppercase text-ink-500">pts</span>
                </div>
                <SessionLinkLabel session={s} />
              </div>
            </Link>
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

function formatPoints(n: number): string {
  if (n === Math.floor(n)) return `${n}`;
  return n.toFixed(1);
}

function hexTint(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function SessionStatusDot({
  session,
}: {
  session: { status: string; pairings_revealed: boolean };
}) {
  if (session.status === "in_progress") {
    return (
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-schloss-bright animate-pulse-live" />
        <span className="text-eyebrow uppercase text-schloss-bright">Live</span>
      </div>
    );
  }
  if (session.status === "complete") {
    return <span className="text-eyebrow uppercase text-ink-500">Final</span>;
  }
  if (session.pairings_revealed) {
    return (
      <span className="text-eyebrow uppercase text-schloss-bright">Revealed</span>
    );
  }
  return <span className="text-eyebrow uppercase text-ink-600">Upcoming</span>;
}

function SessionLinkLabel({
  session,
}: {
  session: { status: string; pairings_revealed: boolean };
}) {
  const label =
    session.status === "in_progress"
      ? "View live →"
      : session.status === "complete"
        ? "View result →"
        : session.pairings_revealed
          ? "View matches →"
          : "View →";
  return (
    <span className="text-eyebrow uppercase text-schloss-bright opacity-0 group-hover:opacity-100 transition-opacity">
      {label}
    </span>
  );
}

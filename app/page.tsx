import Link from "next/link";
import { Countdown } from "@/components/Countdown";
import { TeamCrest } from "@/components/TeamCrest";
import { AppHeader } from "@/components/AppHeader";
import { LiveTournamentRefresher } from "@/components/realtime/LiveTournamentRefresher";
import { getLandingData } from "@/lib/queries/landing";
import { createAdminClient } from "@/lib/supabase/admin";
import { evaluateMatch, type HoleScoreRow } from "@/lib/scoring/evaluate";

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

async function getTournamentTotals(tournamentId: string): Promise<{
  pointsA: number;
  pointsB: number;
  matchesStarted: boolean;
}> {
  const supabase = createAdminClient();

  const { data: sessions } = await supabase
    .from("session")
    .select("id, points_per_match")
    .eq("tournament_id", tournamentId);

  if (!sessions || sessions.length === 0) {
    return { pointsA: 0, pointsB: 0, matchesStarted: false };
  }

  const sessionIds = sessions.map((s) => s.id);
  const pointsBySession = new Map(
    sessions.map((s) => [s.id, Number(s.points_per_match)])
  );

  const { data: teams } = await supabase
    .from("team")
    .select("id, display_order")
    .eq("tournament_id", tournamentId)
    .order("display_order", { ascending: true, nullsFirst: false });

  if (!teams || teams.length < 2) {
    return { pointsA: 0, pointsB: 0, matchesStarted: false };
  }

  const teamAId = teams[0].id;

  const { data: tournament } = await supabase
    .from("tournament")
    .select("end_match_early")
    .eq("id", tournamentId)
    .single();

  const endMatchEarly = tournament?.end_match_early ?? true;

  const { data: course } = await supabase
    .from("course")
    .select("id")
    .eq("tournament_id", tournamentId)
    .limit(1)
    .single();

  const { data: holeRows } = course
    ? await supabase
        .from("hole")
        .select("hole_number, par, stroke_index")
        .eq("course_id", course.id)
        .order("hole_number", { ascending: true })
    : { data: [] };

  const holes = (holeRows ?? []).map((h) => ({
    hole_number: h.hole_number,
    par: h.par,
    stroke_index: h.stroke_index,
  }));

  const { data: matches } = await supabase
    .from("match")
    .select("id, session_id, status, winning_team_id, team_a_pairing_id")
    .in("session_id", sessionIds);

  if (!matches || matches.length === 0) {
    return { pointsA: 0, pointsB: 0, matchesStarted: false };
  }

  const matchIds = matches.map((m) => m.id);

  const { data: allScores } = await supabase
    .from("hole_score")
    .select("match_id, hole_number, scores, result")
    .in("match_id", matchIds);

  let pointsA = 0;
  let pointsB = 0;
  let matchesStarted = false;

  for (const m of matches) {
    const scoreRows: HoleScoreRow[] = (allScores ?? [])
      .filter((r) => r.match_id === m.id)
      .map((r) => ({
        hole_number: r.hole_number,
        scores: r.scores as Record<string, unknown>,
        result: r.result as HoleScoreRow["result"],
      }));

    const pointsPerMatch = pointsBySession.get(m.session_id) ?? 1;

    const concededToA =
      m.status === "conceded" && m.winning_team_id === teamAId;
    const concededToB =
      m.status === "conceded" &&
      m.winning_team_id !== teamAId &&
      m.winning_team_id !== null;

    const evaluation = evaluateMatch(
      holes,
      scoreRows,
      pointsPerMatch,
      endMatchEarly,
      concededToA ? "team_a" : concededToB ? "team_b" : null
    );

    const started =
      scoreRows.length > 0 ||
      evaluation.complete ||
      m.status !== "pending";
    if (started) matchesStarted = true;

    if (evaluation.complete) {
      pointsA += evaluation.points.team_a;
      pointsB += evaluation.points.team_b;
    } else if (started) {
      switch (evaluation.status.state) {
        case "team_a_up":
          pointsA += pointsPerMatch;
          break;
        case "team_b_up":
          pointsB += pointsPerMatch;
          break;
        case "all_square":
          pointsA += pointsPerMatch / 2;
          pointsB += pointsPerMatch / 2;
          break;
      }
    }
  }

  return { pointsA, pointsB, matchesStarted };
}

export default async function Home() {
  const data = await getLandingData();

  if (!data) {
    return (
      <main className="min-h-screen bg-radial-schloss flex items-center justify-center p-8">
        <div className="text-center space-y-3">
          <div className="text-eyebrow uppercase text-tbc">Error</div>
          <p className="text-ink-500 text-sm">
            Could not load tournament data. Check Supabase env vars.
          </p>
        </div>
      </main>
    );
  }

  const { tournament, teams, sessions } = data;
  const [teamA, teamB] = teams;

  const totals = await getTournamentTotals(tournament.id);

  const countdownTarget =
    sessions[0]?.start_at ?? tournament.start_date ?? FALLBACK_START;

  const totalPoints = sessions.reduce(
    (sum, s) => sum + s.match_count * s.points_per_match,
    0
  );

  const playedPoints = totals.pointsA + totals.pointsB;
  const pointsToWin = Number(tournament.points_to_win);
  const pctA = totalPoints > 0 ? (totals.pointsA / totalPoints) * 100 : 0;
  const pctB = totalPoints > 0 ? (totals.pointsB / totalPoints) * 100 : 0;
  const pctTarget = totalPoints > 0 ? (pointsToWin / totalPoints) * 100 : 50;

  return (
    <main className="min-h-screen bg-radial-schloss texture-noise">
      <LiveTournamentRefresher />

      <AppHeader eyebrow={`${tournament.name} · MMXXVI`} />

      {/* HERO */}
      <section className="px-4 md:px-8 pt-6 md:pt-12 pb-6 max-w-6xl mx-auto">
        <div className="text-center mb-5 md:mb-10">
          <div className="text-eyebrow uppercase text-schloss-deep mb-3">
            Golf Club Schloss Ernegg · Austria
          </div>
          <h1 className="font-display text-4xl md:text-hero text-ink-900 leading-[0.95]">
            The {tournament.name}
          </h1>
          <p className="mt-3 md:mt-5 text-sm md:text-lg text-ink-500 max-w-xl mx-auto">
            {teamA.player_count + teamB.player_count} players · two teams ·
            three days of match play
          </p>
        </div>

        {totals.matchesStarted ? (
          <div className="card-light-glow overflow-hidden">
            <div className="px-4 py-2.5 flex items-center justify-between border-b border-ink-100">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-schloss-bright animate-pulse-live" />
                <span className="text-eyebrow uppercase text-schloss-deep">
                  Live
                </span>
              </div>
              <span className="text-[10px] uppercase tracking-[0.15em] text-ink-400 font-mono tabular">
                {formatPoints(playedPoints)} / {totalPoints} pts
              </span>
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] items-center px-4 py-5 md:py-7 gap-2">
              <TeamScoreColumn team={teamA} points={totals.pointsA} align="right" />
              <div className="font-display text-3xl md:text-5xl text-ink-300 italic px-2 select-none">
                —
              </div>
              <TeamScoreColumn team={teamB} points={totals.pointsB} align="left" />
            </div>

            {/* Progress to win */}
            <div className="px-4 pb-4">
              <div className="relative h-1.5 bg-ink-100 rounded-full overflow-hidden">
                <div
                  className="absolute left-0 top-0 bottom-0"
                  style={{
                    width: `${pctA}%`,
                    backgroundColor: teamA.colour_primary ?? "#3B8BE8",
                  }}
                />
                <div
                  className="absolute right-0 top-0 bottom-0"
                  style={{
                    width: `${pctB}%`,
                    backgroundColor: teamB.colour_primary ?? "#E24B4A",
                  }}
                />
                <div
                  className="absolute -top-1 -bottom-1 w-[2px] bg-schloss-deep rounded-sm"
                  style={{ left: `${pctTarget}%` }}
                  aria-label={`${pointsToWin} to win`}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-ink-500">
                <span>
                  {formatPoints(playedPoints)} of {totalPoints} played
                </span>
                <span>
                  <strong className="text-ink-900 font-medium">
                    {formatPoints(pointsToWin)}
                  </strong>{" "}
                  to win
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <Countdown target={countdownTarget} />
          </div>
        )}
      </section>

      {/* TEAM v TEAM — desktop only */}
      <section className="hidden md:block px-8 py-16 max-w-6xl mx-auto">
        <div className="hairline mb-12" />
        <div className="text-center mb-12">
          <div className="text-eyebrow uppercase text-ink-400 mb-3">The Tie</div>
          <h2 className="font-display text-display text-ink-900">
            Team versus Team
          </h2>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] gap-16 items-center">
          <TeamCrest
            team="sandbaggers"
            name={teamA.name}
            captain={teamA.captain?.display_name ?? "—"}
            players={teamA.player_count}
            handicapTotal={teamA.handicap_total ?? 0}
            align="right"
          />

          <div className="flex flex-col items-center gap-3">
            <div className="font-display text-5xl font-light text-ink-400 italic">
              vs
            </div>
            <div className="hairline-v h-16" />
            <div className="text-eyebrow uppercase text-ink-400">
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

      {/* SESSIONS */}
      <section className="px-4 md:px-8 pb-20 md:pb-16 max-w-6xl mx-auto">
        <div className="md:hidden hairline my-2" />
        <div className="md:text-center mb-4 md:mb-12 mt-4 md:mt-0 px-1">
          <div className="text-eyebrow uppercase text-ink-400 mb-1 md:mb-3">
            The Format
          </div>
          <h2 className="font-display text-2xl md:text-display text-ink-900">
            {sessions.length} sessions · {totalPoints} points
          </h2>
        </div>

        {/* Mobile: stacked session pills */}
        <div className="md:hidden flex flex-col gap-2">
          {sessions.map((s) => (
            <Link
              key={s.id}
              href={`/session/${s.id}`}
              className="card-light flex items-center gap-3 px-3 py-3 active:bg-ink-100/60 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-schloss-deep text-white font-display text-base flex items-center justify-center shrink-0">
                {s.session_number}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] text-ink-500">
                  <span>
                    {DAY_LABELS[s.day_number] ?? `Day ${s.day_number}`}
                  </span>
                  <span>·</span>
                  <span>{sessionTimeLabel(s)}</span>
                </div>
                <div className="font-display text-base text-ink-900 leading-snug truncate">
                  {FORMAT_LABELS[s.format] ?? s.format}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono tabular text-base text-ink-900">
                  {s.match_count * s.points_per_match}
                  <span className="text-[10px] uppercase tracking-wider text-ink-400 ml-1">
                    pts
                  </span>
                </div>
                <div className="mt-0.5 flex justify-end">
                  <SessionStatusDot session={s} />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Desktop: editorial 5-col grid */}
        <div className="hidden md:grid grid-cols-5 gap-px bg-ink-100 border border-ink-100 rounded-sm overflow-hidden">
          {sessions.map((s) => (
            <Link
              key={s.id}
              href={`/session/${s.id}`}
              className="bg-white p-6 hover:bg-ink-100/40 transition-colors block group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="text-eyebrow uppercase text-schloss-deep">
                  Session {s.session_number}
                </div>
                <SessionStatusDot session={s} />
              </div>
              <div className="text-ink-500 text-sm">
                {DAY_LABELS[s.day_number] ?? `Day ${s.day_number}`}
              </div>
              <div className="text-ink-600 text-sm mb-5">
                {sessionTimeLabel(s)}
              </div>
              <div className="font-display text-2xl text-ink-900 leading-tight">
                {FORMAT_LABELS[s.format] ?? s.format}
              </div>
              <div className="mt-4 flex items-baseline justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono tabular text-2xl text-ink-900">
                    {s.match_count * s.points_per_match}
                  </span>
                  <span className="text-eyebrow uppercase text-ink-400">
                    pts
                  </span>
                </div>
                <SessionLinkLabel session={s} />
              </div>
            </Link>
          ))}
        </div>

        {/* Tournament stats strip */}
        <div className="mt-8 md:mt-12 grid grid-cols-3 md:flex md:justify-center md:gap-16 items-center text-center">
          <div className="px-1">
            <div className="font-mono tabular text-2xl md:text-4xl font-light text-ink-900">
              {tournament.points_to_win}
            </div>
            <div className="text-eyebrow uppercase text-ink-400 mt-1 md:mt-2">
              To Win
            </div>
          </div>
          <div className="hidden md:block hairline-v h-12" />
          <div className="px-1 border-l border-r border-ink-100/70 md:border-0">
            <div className="font-mono tabular text-2xl md:text-4xl font-light text-ink-900">
              {tournament.points_to_tie}–{tournament.points_to_tie}
            </div>
            <div className="text-eyebrow uppercase text-ink-400 mt-1 md:mt-2">
              Tie
            </div>
          </div>
          <div className="hidden md:block hairline-v h-12" />
          <div className="px-1">
            <div className="font-mono tabular text-2xl md:text-4xl font-light text-ink-900">
              72
            </div>
            <div className="text-eyebrow uppercase text-ink-400 mt-1 md:mt-2">
              Par
            </div>
          </div>
        </div>
      </section>

      <footer className="px-4 md:px-8 py-6 max-w-6xl mx-auto pb-safe">
        <div className="hairline mb-5" />
        <div className="flex flex-col md:flex-row justify-between items-center gap-2 md:gap-4 text-[10px] text-ink-400">
          <div className="text-eyebrow uppercase">
            Niederösterreich · Austria
          </div>
          <div className="text-eyebrow uppercase">
            Live scoring · updates every second
          </div>
        </div>
      </footer>
    </main>
  );
}

function TeamScoreColumn({
  team,
  points,
  align,
}: {
  team: { name: string; colour_primary: string | null };
  points: number;
  align: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <div
        className="text-eyebrow uppercase mb-1.5"
        style={{ color: team.colour_primary ?? "#1E5631" }}
      >
        {team.name}
      </div>
      <div
        className="font-mono tabular text-5xl md:text-7xl font-light leading-none"
        style={{ color: team.colour_primary ?? "#1E5631" }}
      >
        {formatPoints(points)}
      </div>
    </div>
  );
}

function formatPoints(n: number): string {
  if (n === Math.floor(n)) return `${n}`;
  return n.toFixed(1);
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
        <span className="text-eyebrow uppercase text-schloss-deep">Live</span>
      </div>
    );
  }
  if (session.status === "complete") {
    return (
      <span className="text-eyebrow uppercase text-ink-400">Final</span>
    );
  }
  if (session.pairings_revealed) {
    return (
      <span className="text-eyebrow uppercase text-schloss-deep">
        Revealed
      </span>
    );
  }
  return <span className="text-eyebrow uppercase text-ink-400">Upcoming</span>;
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
    <span className="text-eyebrow uppercase text-schloss-deep opacity-0 group-hover:opacity-100 transition-opacity">
      {label}
    </span>
  );
}

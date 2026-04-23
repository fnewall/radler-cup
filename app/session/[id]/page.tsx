import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionDetail } from "@/lib/queries/session";
import { GearButton } from "@/components/GearButton";
import { LiveSessionRefresher } from "@/components/realtime/LiveSessionRefresher";
import { formatViennaDisplay } from "@/lib/timezone";

export const dynamic = "force-dynamic";

const FORMAT_LABELS: Record<string, string> = {
  foursomes: "Foursomes",
  betterball: "Betterball",
  greensomes: "Greensomes",
  scramble_2v2: "Scramble",
  singles: "Singles",
};

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getSessionDetail(id);
  if (!data) notFound();

  const { tournament, session, teams, submissionStatus, matches } = data;
  const teamA = teams[0];
  const teamB = teams[1];
  const formatLabel = FORMAT_LABELS[session.format] ?? session.format;

  // Session points totals (live)
  let pointsA = 0;
  let pointsB = 0;
  for (const m of matches) {
    pointsA += Number(m.points_team_a) || 0;
    pointsB += Number(m.points_team_b) || 0;
  }

  // Points remaining
  const totalPointsForSession = session.match_count * 1; // points_per_match = 1 assumed
  const pointsRemaining = Math.max(0, totalPointsForSession - pointsA - pointsB);

  return (
    <main className="min-h-screen bg-radial-schloss texture-noise">
      {session.pairings_revealed && (
        <LiveSessionRefresher
          sessionId={session.id}
          matchIds={matches.map((m) => m.id)}
        />
      )}

      <header className="flex items-center justify-between px-6 md:px-10 py-6">
        <Link
          href="/"
          className="text-eyebrow uppercase text-ink-400 hover:text-ink-100 transition-colors"
        >
          ← {tournament.name}
        </Link>
        <GearButton />
      </header>

      <section className="px-6 md:px-10 pt-8 pb-6 max-w-5xl mx-auto">
        <div className="text-eyebrow uppercase text-schloss-bright mb-3">
          Session {session.session_number} · Day {session.day_number}
        </div>
        <h1 className="font-display text-display text-ink-100 leading-[0.95] mb-3">
          {session.label}
        </h1>
        <p className="text-ink-400 text-sm">
          {formatLabel} · {session.match_count} matches ·{" "}
          {formatViennaDisplay(session.start_at)}
          {session.tees_used && (
            <span className="ml-2 text-ink-500">· {session.tees_used} tees</span>
          )}
        </p>
      </section>

      {/* Session score banner — only if pairings revealed */}
      {session.pairings_revealed && teamA && teamB && (
        <section className="px-6 md:px-10 pb-6 max-w-5xl mx-auto">
          <div className="bg-ink-950 border border-ink-800 rounded-sm overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_1fr] items-stretch">
              {/* Team A score */}
              <div
                className="py-5 px-6 flex items-center justify-end gap-4"
                style={{ backgroundColor: hexTint(teamA.colour_primary, 0.08) }}
              >
                <div
                  className="text-eyebrow uppercase"
                  style={{ color: teamA.colour_primary }}
                >
                  {teamA.name}
                </div>
                <div
                  className="font-mono tabular text-4xl md:text-5xl font-light"
                  style={{ color: teamA.colour_primary }}
                >
                  {formatPoints(pointsA)}
                </div>
              </div>

              {/* Centre label */}
              <div className="flex items-center justify-center px-4 bg-ink-900 border-x border-ink-800">
                <div className="text-center">
                  <div className="text-eyebrow uppercase text-ink-500 mb-1">
                    {pointsRemaining > 0 ? "Live" : "Final"}
                  </div>
                  <div className="text-xs text-ink-400 font-mono tabular">
                    {pointsRemaining > 0
                      ? `${formatPoints(pointsRemaining)} left`
                      : "Session"}
                  </div>
                </div>
              </div>

              {/* Team B score */}
              <div
                className="py-5 px-6 flex items-center justify-start gap-4"
                style={{ backgroundColor: hexTint(teamB.colour_primary, 0.08) }}
              >
                <div
                  className="font-mono tabular text-4xl md:text-5xl font-light"
                  style={{ color: teamB.colour_primary }}
                >
                  {formatPoints(pointsB)}
                </div>
                <div
                  className="text-eyebrow uppercase"
                  style={{ color: teamB.colour_primary }}
                >
                  {teamB.name}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="px-6 md:px-10 pb-24 max-w-5xl mx-auto">
        {!session.pairings_revealed ? (
          <PairingsPending
            teamA={teamA}
            teamB={teamB}
            submittedA={submissionStatus.team_a_submitted}
            submittedB={submissionStatus.team_b_submitted}
          />
        ) : (
          <MatchesList matches={matches} teamA={teamA} teamB={teamB} />
        )}
      </section>
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

function PairingsPending({
  teamA,
  teamB,
  submittedA,
  submittedB,
}: {
  teamA?: { id: string; name: string; colour_primary: string };
  teamB?: { id: string; name: string; colour_primary: string };
  submittedA: boolean;
  submittedB: boolean;
}) {
  return (
    <div>
      <div className="text-center mb-10">
        <div className="text-eyebrow uppercase text-ink-500 mb-3">Awaiting Reveal</div>
        <h2 className="font-display text-3xl text-ink-100 mb-2">
          Pairings pending
        </h2>
        <p className="text-ink-400 text-sm max-w-md mx-auto">
          Both captains submit their line-ups in secret. Once both are in, pairings reveal to everyone at the same time.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto">
        {teamA && <CaptainStatusCard team={teamA} submitted={submittedA} />}
        {teamB && <CaptainStatusCard team={teamB} submitted={submittedB} />}
      </div>
    </div>
  );
}

function CaptainStatusCard({
  team,
  submitted,
}: {
  team: { name: string; colour_primary: string };
  submitted: boolean;
}) {
  return (
    <div className="bg-ink-950 border border-ink-800 rounded-sm p-6 text-center">
      <div
        className="w-2 h-2 rounded-full mx-auto mb-4"
        style={{
          backgroundColor: submitted ? team.colour_primary : "transparent",
          border: submitted ? "none" : `1px dashed ${team.colour_primary}`,
        }}
      />
      <div
        className="text-eyebrow uppercase mb-2"
        style={{ color: team.colour_primary }}
      >
        {team.name}
      </div>
      <div className="text-sm text-ink-300">
        {submitted ? "Submitted" : "Waiting for captain"}
      </div>
    </div>
  );
}

type MatchItem = {
  id: string;
  match_order: number;
  status: string;
  winning_team_id: string | null;
  points_team_a: number;
  points_team_b: number;
  ended_on_hole: number | null;
  team_a: MatchSideData;
  team_b: MatchSideData;
};

type MatchSideData = {
  team_id: string;
  team_name: string;
  team_display_code: string;
  team_colour: string;
  players: Array<{ id: string; display_name: string; handicap: number | null; slot: number }>;
};

function MatchesList({
  matches,
  teamA,
  teamB,
}: {
  matches: MatchItem[];
  teamA?: { id: string; name: string; colour_primary: string };
  teamB?: { id: string; name: string; colour_primary: string };
}) {
  if (!matches || matches.length === 0) {
    return (
      <div className="bg-ink-950 border border-ink-800 rounded-sm p-8 text-center text-ink-400 text-sm">
        No matches created yet.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-6 flex-wrap gap-3">
        <div className="text-eyebrow uppercase text-schloss-bright">
          Matches · {matches.length}
        </div>
        {teamA && teamB && (
          <div className="text-xs text-ink-500 flex items-center gap-3">
            <span style={{ color: teamA.colour_primary }}>{teamA.name}</span>
            <span className="text-ink-700">vs</span>
            <span style={{ color: teamB.colour_primary }}>{teamB.name}</span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {matches.map((m) => (
          <MatchRow key={m.id} match={m} />
        ))}
      </div>
    </div>
  );
}

type MatchState =
  | { kind: "pending" }
  | { kind: "as"; thru: number }
  | { kind: "team_a_up"; by: number; thru: number; complete: boolean; margin?: string }
  | { kind: "team_b_up"; by: number; thru: number; complete: boolean; margin?: string }
  | { kind: "halved" };

function deriveMatchState(m: MatchItem): MatchState {
  if (m.status === "pending") return { kind: "pending" };
  if (m.status === "complete_tied") return { kind: "halved" };

  const holesPlayed = m.ended_on_hole ?? 18;

  if (m.status === "complete_decided" || m.status === "conceded") {
    const aWins = m.points_team_a > m.points_team_b;
    // Margin: if ended early, we have ended_on_hole; the actual margin comes from the difference
    // The evaluator already stored points; we reconstruct the display from status
    return aWins
      ? { kind: "team_a_up", by: 0, thru: holesPlayed, complete: true }
      : { kind: "team_b_up", by: 0, thru: holesPlayed, complete: true };
  }

  // In progress: we don't have the raw delta here without re-deriving. Use points as proxy.
  // Better: surface "in progress" state and let the row show "THRU N" with the points leader.
  const aLeading = m.points_team_a > m.points_team_b;
  const bLeading = m.points_team_b > m.points_team_a;
  if (aLeading) return { kind: "team_a_up", by: 0, thru: holesPlayed, complete: false };
  if (bLeading) return { kind: "team_b_up", by: 0, thru: holesPlayed, complete: false };
  return { kind: "as", thru: holesPlayed };
}

function MatchRow({ match }: { match: MatchItem }) {
  const state = deriveMatchState(match);
  const aColour = match.team_a.team_colour;
  const bColour = match.team_b.team_colour;

  // Determine fills
  let aFill: React.CSSProperties = { backgroundColor: "transparent" };
  let bFill: React.CSSProperties = { backgroundColor: "transparent" };
  let aTextColour = "#E4E9E6";
  let bTextColour = "#E4E9E6";

  let centreContent: React.ReactNode;

  if (state.kind === "pending") {
    centreContent = <CentreBadge text="UPCOMING" colour="#8A9A92" />;
  } else if (state.kind === "as") {
    centreContent = (
      <div className="text-center">
        <div className="text-eyebrow uppercase text-ink-500">AS</div>
        <div className="text-[10px] text-ink-500 font-mono tabular mt-0.5">
          thru {state.thru}
        </div>
      </div>
    );
  } else if (state.kind === "halved") {
    centreContent = (
      <div className="text-center">
        <div className="text-eyebrow uppercase text-ink-300">Halved</div>
        <div className="text-[10px] text-ink-500 font-mono tabular mt-0.5">
          Final
        </div>
      </div>
    );
  } else if (state.kind === "team_a_up") {
    aFill = { backgroundColor: aColour };
    aTextColour = "#FFFFFF";
    centreContent = (
      <div className="text-center">
        <div className="text-eyebrow uppercase text-ink-500">
          {state.complete ? "Final" : "Live"}
        </div>
        <div className="text-[10px] text-ink-500 font-mono tabular mt-0.5">
          thru {state.thru}
        </div>
      </div>
    );
  } else if (state.kind === "team_b_up") {
    bFill = { backgroundColor: bColour };
    bTextColour = "#FFFFFF";
    centreContent = (
      <div className="text-center">
        <div className="text-eyebrow uppercase text-ink-500">
          {state.complete ? "Final" : "Live"}
        </div>
        <div className="text-[10px] text-ink-500 font-mono tabular mt-0.5">
          thru {state.thru}
        </div>
      </div>
    );
  }

  return (
    <Link
      href={`/match/${match.id}`}
      className="block bg-ink-950 border border-ink-800 rounded-sm hover:border-ink-700 transition-colors overflow-hidden"
    >
      <div className="grid grid-cols-[56px_1fr_auto_1fr] items-stretch min-h-[76px]">
        {/* Match number */}
        <div className="flex items-center justify-center py-4 border-r border-ink-800 font-mono tabular text-xl font-light text-schloss-bright">
          {String(match.match_order).padStart(2, "0")}
        </div>

        {/* Team A side */}
        <MatchSide
          side={match.team_a}
          align="right"
          fill={aFill}
          textColour={aTextColour}
        />

        {/* Centre */}
        <div className="flex items-center justify-center px-4 min-w-[88px] border-x border-ink-800 bg-ink-900">
          {centreContent}
        </div>

        {/* Team B side */}
        <MatchSide
          side={match.team_b}
          align="left"
          fill={bFill}
          textColour={bTextColour}
        />
      </div>
    </Link>
  );
}

function MatchSide({
  side,
  align,
  fill,
  textColour,
}: {
  side: MatchSideData;
  align: "left" | "right";
  fill: React.CSSProperties;
  textColour: string;
}) {
  return (
    <div
      className={`py-3 px-4 flex flex-col justify-center transition-colors ${
        align === "right" ? "items-end text-right" : "items-start text-left"
      }`}
      style={fill}
    >
      <div
        className="text-[10px] uppercase tracking-widest font-medium mb-1 opacity-80"
        style={{ color: textColour }}
      >
        {side.team_display_code}
      </div>
      <div className="flex flex-col gap-0.5">
        {side.players.map((p) => (
          <div
            key={p.slot}
            className={`text-sm leading-tight flex items-baseline gap-2 ${
              align === "right" ? "flex-row-reverse" : ""
            }`}
            style={{ color: textColour }}
          >
            <span className="font-medium">{p.display_name}</span>
            {p.handicap !== null && (
              <span className="font-mono tabular text-xs opacity-60">
                {p.handicap}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CentreBadge({ text, colour }: { text: string; colour: string }) {
  return (
    <div className="text-center">
      <div
        className="text-eyebrow uppercase"
        style={{ color: colour }}
      >
        {text}
      </div>
    </div>
  );
}

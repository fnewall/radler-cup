import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionDetail } from "@/lib/queries/session";
import { GearButton } from "@/components/GearButton";
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

  return (
    <main className="min-h-screen bg-radial-schloss texture-noise">
      <header className="flex items-center justify-between px-6 md:px-10 py-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-eyebrow uppercase text-ink-400 hover:text-ink-100 transition-colors"
          >
            ← {tournament.name}
          </Link>
        </div>
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

      <div className="px-6 md:px-10 max-w-5xl mx-auto">
        <div className="hairline my-8" />
      </div>

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
        {teamA && (
          <CaptainStatusCard team={teamA} submitted={submittedA} />
        )}
        {teamB && (
          <CaptainStatusCard team={teamB} submitted={submittedB} />
        )}
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
          animation: submitted ? undefined : "pulse 2s infinite",
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
          <MatchCard key={m.id} match={m} />
        ))}
      </div>
    </div>
  );
}

function MatchCard({ match }: { match: MatchItem }) {
  return (
    <Link
      href={`/match/${match.id}`}
      className="block bg-ink-950 border border-ink-800 rounded-sm hover:border-ink-700 hover:bg-ink-900 transition-colors overflow-hidden"
    >
      {/* Mobile layout: stacked */}
      <div className="md:hidden p-4">
        <div className="flex items-center justify-between mb-3">
          <div
            className="font-mono tabular text-base font-light text-schloss-bright"
          >
            Match {String(match.match_order).padStart(2, "0")}
          </div>
          <StatusBadge match={match} />
        </div>

        <div className="space-y-3">
          <SideMobile side={match.team_a} />
          <div className="text-center text-eyebrow uppercase text-ink-600 text-[10px]">
            vs
          </div>
          <SideMobile side={match.team_b} />
        </div>
      </div>

      {/* Desktop layout: horizontal */}
      <div className="hidden md:grid md:grid-cols-[72px_1fr_auto_1fr_96px] items-stretch">
        <div className="flex items-center justify-center py-4 border-r border-ink-800 font-mono tabular text-xl font-light text-schloss-bright">
          {String(match.match_order).padStart(2, "0")}
        </div>

        <SideDesktop side={match.team_a} align="right" />

        <div className="flex items-center justify-center px-2 text-eyebrow uppercase text-ink-600">
          vs
        </div>

        <SideDesktop side={match.team_b} align="left" />

        <div className="flex items-center justify-center border-l border-ink-800 py-4">
          <StatusBadge match={match} />
        </div>
      </div>
    </Link>
  );
}

function SideMobile({ side }: { side: MatchSideData }) {
  return (
    <div>
      <div
        className="text-eyebrow uppercase mb-1.5"
        style={{ color: side.team_colour }}
      >
        {side.team_display_code} · {side.team_name}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {side.players.map((p) => (
          <div key={p.slot} className="text-sm text-ink-100 flex items-baseline gap-1.5">
            <span>{p.display_name}</span>
            {p.handicap !== null && (
              <span className="font-mono tabular text-xs text-ink-500">
                {p.handicap}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SideDesktop({
  side,
  align,
}: {
  side: MatchSideData;
  align: "left" | "right";
}) {
  return (
    <div
      className={`py-4 px-4 flex flex-col justify-center ${
        align === "right" ? "items-end text-right" : "items-start text-left"
      }`}
    >
      <div
        className="text-eyebrow uppercase mb-1.5"
        style={{ color: side.team_colour }}
      >
        {side.team_display_code}
      </div>
      <div className="flex flex-col gap-0.5">
        {side.players.map((p) => (
          <div
            key={p.slot}
            className={`text-sm text-ink-100 leading-tight flex items-baseline gap-2 ${
              align === "right" ? "flex-row-reverse" : ""
            }`}
          >
            <span>{p.display_name}</span>
            {p.handicap !== null && (
              <span className="font-mono tabular text-xs text-ink-500">
                {p.handicap}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ match }: { match: MatchItem }) {
  if (match.status === "pending") {
    return (
      <div className="text-eyebrow uppercase text-ink-500 text-center">
        Upcoming
      </div>
    );
  }
  if (match.status === "in_progress") {
    return (
      <div className="text-eyebrow uppercase text-schloss-bright text-center">
        Live
      </div>
    );
  }
  if (match.status === "complete_tied") {
    return (
      <div className="text-eyebrow uppercase text-ink-400 text-center">
        Halved
      </div>
    );
  }
  if (match.status === "conceded" || match.status === "complete_decided") {
    return (
      <div className="text-eyebrow uppercase text-ink-400 text-center">
        Final
      </div>
    );
  }
  return null;
}

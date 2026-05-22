"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Team = {
  id: string;
  name: string;
  display_code: string;
  colour_primary: string;
  display_order: number | null;
};

type SessionRow = {
  id: string;
  session_number: number;
  label: string;
  format: string;
  format_label: string;
  match_count: number;
  points_per_match: number;
};

type MatchRow = {
  id: string;
  session_id: string;
  match_order: number;
  status: string;
  winning_team_id: string | null;
  points_team_a: number;
  points_team_b: number;
  ended_on_hole: number | null;
  team_a_pairing_id: string;
  team_b_pairing_id: string;
  scores_entered: number;
};

type PairingPlayer = {
  pairing_id: string;
  player_id: string;
  slot: number;
};

type Player = {
  id: string;
  display_name: string;
  team_id: string;
};

type Props = {
  teams: Team[];
  sessions: SessionRow[];
  matches: MatchRow[];
  pairingPlayers: PairingPlayer[];
  players: Player[];
};

export function AdminMatchesList({
  teams,
  sessions,
  matches,
  pairingPlayers,
  players,
}: Props) {
  const [openSessionId, setOpenSessionId] = useState<string | null>(
    sessions[0]?.id ?? null
  );

  return (
    <div className="space-y-3">
      {sessions.map((s) => {
        const sessionMatches = matches.filter((m) => m.session_id === s.id);
        const isOpen = openSessionId === s.id;
        return (
          <SessionBlock
            key={s.id}
            session={s}
            matches={sessionMatches}
            teams={teams}
            pairingPlayers={pairingPlayers}
            players={players}
            open={isOpen}
            onToggle={() => setOpenSessionId(isOpen ? null : s.id)}
          />
        );
      })}
    </div>
  );
}

function SessionBlock({
  session,
  matches,
  teams,
  pairingPlayers,
  players,
  open,
  onToggle,
}: {
  session: SessionRow;
  matches: MatchRow[];
  teams: Team[];
  pairingPlayers: PairingPlayer[];
  players: Player[];
  open: boolean;
  onToggle: () => void;
}) {
  const totalScored = matches.filter((m) => m.scores_entered > 0).length;

  return (
    <div className="bg-ink-950 border border-ink-800 rounded-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-ink-900 transition-colors"
      >
        <div className="flex items-baseline gap-4">
          <div className="font-mono tabular text-2xl font-light text-schloss-bright">
            {String(session.session_number).padStart(2, "0")}
          </div>
          <div>
            <div className="text-ink-100 font-medium">{session.label}</div>
            <div className="text-xs text-ink-400 mt-1">
              {session.format_label} · {matches.length} match
              {matches.length === 1 ? "" : "es"} · {totalScored} in play
            </div>
          </div>
        </div>
        <span className="text-ink-500 text-lg">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="border-t border-ink-800 p-5 space-y-3">
          {matches.length === 0 ? (
            <div className="text-sm text-ink-500 italic">
              No matches created yet for this session.
            </div>
          ) : (
            matches.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                session={session}
                teams={teams}
                pairingPlayers={pairingPlayers}
                players={players}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function MatchCard({
  match,
  session,
  teams,
  pairingPlayers,
  players,
}: {
  match: MatchRow;
  session: SessionRow;
  teams: Team[];
  pairingPlayers: PairingPlayer[];
  players: Player[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    label: string;
    body: Record<string, unknown>;
    confirmText: string;
    danger: boolean;
  } | null>(null);

  const teamA = teams[0];
  const teamB = teams[1];

  const aPlayerNames = useMemo(
    () =>
      pairingPlayers
        .filter((pp) => pp.pairing_id === match.team_a_pairing_id)
        .sort((x, y) => x.slot - y.slot)
        .map((pp) => players.find((p) => p.id === pp.player_id)?.display_name ?? "?"),
    [match.team_a_pairing_id, pairingPlayers, players]
  );
  const bPlayerNames = useMemo(
    () =>
      pairingPlayers
        .filter((pp) => pp.pairing_id === match.team_b_pairing_id)
        .sort((x, y) => x.slot - y.slot)
        .map((pp) => players.find((p) => p.id === pp.player_id)?.display_name ?? "?"),
    [match.team_b_pairing_id, pairingPlayers, players]
  );

  async function callApi(action: string, body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, match_id: match.id, ...body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
      setConfirmAction(null);
    }
  }

  const statusLabel =
    match.status === "pending"
      ? "Not started"
      : match.status === "in_progress"
        ? "In progress"
        : match.status === "complete_decided"
          ? "Complete"
          : match.status === "complete_tied"
            ? "Halved"
            : match.status === "conceded"
              ? "Conceded"
              : match.status;

  const winnerTag =
    match.winning_team_id === teamA?.id
      ? teamA.display_code
      : match.winning_team_id === teamB?.id
        ? teamB.display_code
        : match.status === "complete_tied"
          ? "Halved"
          : null;

  return (
    <div className="bg-ink-900 border border-ink-800 rounded-sm">
      <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-ink-800">
        <div className="flex items-baseline gap-3">
          <span className="font-mono tabular text-lg text-schloss-bright">
            {match.match_order}
          </span>
          <div className="text-xs">
            <span style={{ color: teamA?.colour_primary }}>
              {aPlayerNames.join(" & ") || "—"}
            </span>
            <span className="text-ink-500"> vs </span>
            <span style={{ color: teamB?.colour_primary }}>
              {bPlayerNames.join(" & ") || "—"}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div
            className={`text-eyebrow uppercase ${
              match.status === "in_progress"
                ? "text-schloss-bright"
                : match.status === "pending"
                  ? "text-ink-400"
                  : "text-shot-accent"
            }`}
          >
            {statusLabel}
          </div>
          <div className="text-[10px] text-ink-500 mt-0.5">
            {match.scores_entered} hole{match.scores_entered === 1 ? "" : "s"} scored
          </div>
        </div>
      </div>

      <div className="px-4 py-3">
        {error && (
          <div className="text-xs text-tbc bg-tbc/10 border border-tbc/30 rounded p-2 mb-3">
            {error}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <div
              className="text-eyebrow uppercase mb-1"
              style={{ color: teamA?.colour_primary }}
            >
              {teamA?.display_code}
            </div>
            <div className="font-mono tabular text-2xl font-light text-ink-100">
              {formatPts(match.points_team_a)}
            </div>
          </div>
          <div className="text-center">
            {winnerTag && (
              <div className="text-eyebrow uppercase text-ink-500 mb-1">
                Winner
              </div>
            )}
            {winnerTag && (
              <div className="font-mono tabular text-sm text-ink-200">
                {winnerTag}
              </div>
            )}
            {match.ended_on_hole !== null && (
              <div className="text-[10px] text-ink-500 mt-1">
                Ended on hole {match.ended_on_hole}
              </div>
            )}
          </div>
          <div className="text-right">
            <div
              className="text-eyebrow uppercase mb-1"
              style={{ color: teamB?.colour_primary }}
            >
              {teamB?.display_code}
            </div>
            <div className="font-mono tabular text-2xl font-light text-ink-100">
              {formatPts(match.points_team_b)}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/match/${match.id}`}
            className="h-9 px-3 rounded-md border border-ink-700 text-ink-200 text-xs hover:border-schloss-bright hover:text-schloss-bright transition-colors inline-flex items-center"
          >
            View / edit holes →
          </Link>

          <button
            disabled={busy || match.scores_entered === 0}
            onClick={() =>
              setConfirmAction({
                label: "Reset match",
                body: { action: "reset" },
                confirmText: `Wipe all ${match.scores_entered} hole scores. Match goes back to 'not started'. Cannot undo.`,
                danger: true,
              })
            }
            className="h-9 px-3 rounded-md border border-ink-700 text-ink-300 text-xs hover:border-tbc hover:text-tbc transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Reset (wipe scores)
          </button>

          {match.status !== "conceded" && teamA && teamB && (
            <>
              <button
                disabled={busy}
                onClick={() =>
                  setConfirmAction({
                    label: `Concede to ${teamA.display_code}`,
                    body: { action: "concede", winning_team_id: teamA.id },
                    confirmText: `Give the full match point to ${teamA.name}. Hole scores remain but match is marked complete.`,
                    danger: false,
                  })
                }
                className="h-9 px-3 rounded-md border text-xs transition-colors disabled:opacity-30"
                style={{
                  borderColor: teamA.colour_primary + "66",
                  color: teamA.colour_primary,
                }}
              >
                Concede → {teamA.display_code}
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  setConfirmAction({
                    label: `Concede to ${teamB.display_code}`,
                    body: { action: "concede", winning_team_id: teamB.id },
                    confirmText: `Give the full match point to ${teamB.name}. Hole scores remain but match is marked complete.`,
                    danger: false,
                  })
                }
                className="h-9 px-3 rounded-md border text-xs transition-colors disabled:opacity-30"
                style={{
                  borderColor: teamB.colour_primary + "66",
                  color: teamB.colour_primary,
                }}
              >
                Concede → {teamB.display_code}
              </button>
            </>
          )}

          {(match.status === "conceded" || match.status.startsWith("complete")) && (
            <button
              disabled={busy}
              onClick={() =>
                setConfirmAction({
                  label: "Reopen match",
                  body: { action: "reopen" },
                  confirmText:
                    "Reopen the match. Hole scores stay; status returns to in-progress or pending based on what's there.",
                  danger: false,
                })
              }
              className="h-9 px-3 rounded-md border border-ink-700 text-ink-300 text-xs hover:border-schloss-bright hover:text-schloss-bright transition-colors disabled:opacity-30"
            >
              Reopen
            </button>
          )}

          <button
            disabled={busy}
            onClick={() =>
              setConfirmAction({
                label: "Mark halved (0.5 each)",
                body: { action: "halve" },
                confirmText:
                  "Split the match point — half each. Hole scores remain but match is locked complete.",
                danger: false,
              })
            }
            className="h-9 px-3 rounded-md border border-ink-700 text-ink-300 text-xs hover:border-shot-accent hover:text-shot-accent transition-colors disabled:opacity-30"
          >
            Halve (0.5 each)
          </button>
        </div>
      </div>

      {confirmAction && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/90"
            onClick={() => setConfirmAction(null)}
          />
          <div
            className="relative w-full max-w-sm rounded-lg overflow-hidden shadow-2xl border border-ink-700"
            style={{ backgroundColor: "#0F1512" }}
          >
            <div
              className={`h-0.5 w-full ${
                confirmAction.danger
                  ? "bg-gradient-to-r from-transparent via-tbc to-transparent"
                  : "bg-gradient-to-r from-transparent via-schloss-bright to-transparent"
              }`}
            />
            <div className="p-7">
              <div
                className={`text-eyebrow uppercase mb-2 ${
                  confirmAction.danger ? "text-tbc" : "text-schloss-bright"
                }`}
              >
                Confirm
              </div>
              <h2 className="font-display text-xl text-ink-100 mb-3">
                {confirmAction.label}?
              </h2>
              <p className="text-sm text-ink-300 mb-6 leading-relaxed">
                {confirmAction.confirmText}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 h-10 rounded-md border border-ink-700 text-ink-200 hover:border-ink-500 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    callApi(
                      confirmAction.body.action as string,
                      confirmAction.body
                    )
                  }
                  className={`flex-1 h-10 rounded-md text-white transition-colors text-sm font-medium ${
                    confirmAction.danger
                      ? "bg-tbc hover:opacity-90"
                      : "bg-schloss hover:bg-schloss-bright"
                  }`}
                >
                  {confirmAction.label.split(" ")[0]}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatPts(n: number): string {
  if (n === Math.floor(n)) return String(n);
  return n.toFixed(1);
}

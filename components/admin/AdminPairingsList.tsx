"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

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
  pairings_revealed: boolean;
  status: string;
  start_at: string;
};

type PairingRow = {
  id: string;
  session_id: string;
  team_id: string;
  match_order: number;
  submitted_at: string | null;
};

type PairingPlayer = {
  pairing_id: string;
  player_id: string;
  slot: number;
};

type Player = {
  id: string;
  display_name: string;
  handicap: number | null;
  team_id: string;
};

type Props = {
  teams: Team[];
  sessions: SessionRow[];
  pairings: PairingRow[];
  pairingPlayers: PairingPlayer[];
  players: Player[];
};

export function AdminPairingsList({
  teams,
  sessions,
  pairings,
  pairingPlayers,
  players,
}: Props) {
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {sessions.map((s) => {
        const isOpen = openSessionId === s.id;
        return (
          <SessionCard
            key={s.id}
            session={s}
            teams={teams}
            pairings={pairings.filter((p) => p.session_id === s.id)}
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

function SessionCard({
  session,
  teams,
  pairings,
  pairingPlayers,
  players,
  open,
  onToggle,
}: {
  session: SessionRow;
  teams: Team[];
  pairings: PairingRow[];
  pairingPlayers: PairingPlayer[];
  players: Player[];
  open: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teamA = teams[0];
  const teamB = teams[1];

  const aPairings = pairings.filter((p) => p.team_id === teamA?.id);
  const bPairings = pairings.filter((p) => p.team_id === teamB?.id);

  const aSubmitted =
    aPairings.length > 0 && aPairings.every((p) => p.submitted_at !== null);
  const bSubmitted =
    bPairings.length > 0 && bPairings.every((p) => p.submitted_at !== null);

  async function callApi(action: string, body: Record<string, unknown> = {}) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/pairings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, session_id: session.id, ...body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

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
              {session.format_label} · {session.match_count} max matches
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge revealed={session.pairings_revealed} a={aSubmitted} b={bSubmitted} />
          <span className="text-ink-500 text-lg">{open ? "−" : "+"}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-ink-800 p-5 space-y-6">
          {error && (
            <div className="text-sm text-tbc bg-tbc/10 border border-tbc/30 rounded p-3">
              {error}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {!session.pairings_revealed && (aSubmitted || bSubmitted) && (
              <>
                {aSubmitted && (
                  <button
                    disabled={busy}
                    onClick={() => callApi("unlock", { team_id: teamA.id })}
                    className="h-9 px-3 rounded-md border border-shot-accent/40 bg-shot-bg/30 text-shot-accent text-xs hover:bg-shot-bg/60 transition-colors disabled:opacity-50"
                  >
                    Unlock {teamA.display_code}
                  </button>
                )}
                {bSubmitted && (
                  <button
                    disabled={busy}
                    onClick={() => callApi("unlock", { team_id: teamB.id })}
                    className="h-9 px-3 rounded-md border border-shot-accent/40 bg-shot-bg/30 text-shot-accent text-xs hover:bg-shot-bg/60 transition-colors disabled:opacity-50"
                  >
                    Unlock {teamB.display_code}
                  </button>
                )}
              </>
            )}

            {!session.pairings_revealed && aSubmitted && bSubmitted && (
              <button
                disabled={busy}
                onClick={() => callApi("reveal")}
                className="h-9 px-3 rounded-md bg-schloss text-white text-xs hover:bg-schloss-bright transition-colors disabled:opacity-50"
              >
                Force reveal &amp; create matches
              </button>
            )}

            {session.pairings_revealed && (
              <span className="h-9 px-3 inline-flex items-center rounded-md border border-schloss/30 text-schloss-bright text-xs">
                Revealed — edits push live to all devices
              </span>
            )}
          </div>

          {/* Per-team pairings editor */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TeamPairingsEditor
              team={teamA}
              session={session}
              pairings={aPairings}
              pairingPlayers={pairingPlayers}
              players={players}
              onChange={() => router.refresh()}
            />
            <TeamPairingsEditor
              team={teamB}
              session={session}
              pairings={bPairings}
              pairingPlayers={pairingPlayers}
              players={players}
              onChange={() => router.refresh()}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({
  revealed,
  a,
  b,
}: {
  revealed: boolean;
  a: boolean;
  b: boolean;
}) {
  if (revealed) {
    return (
      <span className="px-2.5 py-1 rounded-full border border-schloss/40 text-schloss-bright text-eyebrow uppercase">
        Revealed
      </span>
    );
  }
  if (a && b) {
    return (
      <span className="px-2.5 py-1 rounded-full border border-shot-accent/40 text-shot-accent text-eyebrow uppercase">
        Ready to reveal
      </span>
    );
  }
  if (a || b) {
    return (
      <span className="px-2.5 py-1 rounded-full border border-shot-accent/40 text-shot-accent text-eyebrow uppercase">
        One in
      </span>
    );
  }
  return (
    <span className="px-2.5 py-1 rounded-full border border-ink-700 text-ink-400 text-eyebrow uppercase">
      Draft
    </span>
  );
}

function TeamPairingsEditor({
  team,
  session,
  pairings,
  pairingPlayers,
  players,
  onChange,
}: {
  team: Team;
  session: SessionRow;
  pairings: PairingRow[];
  pairingPlayers: PairingPlayer[];
  players: Player[];
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const teamPlayers = useMemo(
    () => players.filter((p) => p.team_id === team.id),
    [players, team.id]
  );

  const isPair = session.format !== "singles";
  const maxSize = isPair ? 2 : 1;

  // Group players in pairings by pairing_id
  const slots = useMemo(() => {
    return [...pairings]
      .sort((a, b) => a.match_order - b.match_order)
      .map((p) => {
        const playerIds = pairingPlayers
          .filter((pp) => pp.pairing_id === p.id)
          .sort((a, b) => a.slot - b.slot)
          .map((pp) => pp.player_id);
        return { pairing_id: p.id, match_order: p.match_order, player_ids: playerIds };
      });
  }, [pairings, pairingPlayers]);

  const usedPlayerIds = useMemo(() => {
    const s = new Set<string>();
    for (const slot of slots) for (const pid of slot.player_ids) s.add(pid);
    return s;
  }, [slots]);

  async function callOverride(action: string, body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/pairings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          session_id: session.id,
          team_id: team.id,
          ...body,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      onChange();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  function playerById(id: string) {
    return players.find((p) => p.id === id);
  }

  return (
    <div className="border border-ink-800 rounded-sm overflow-hidden">
      <div
        className="px-4 py-3 border-b border-ink-800 flex items-baseline justify-between"
        style={{ backgroundColor: team.colour_primary + "12" }}
      >
        <div
          className="text-eyebrow uppercase"
          style={{ color: team.colour_primary }}
        >
          {team.name}
        </div>
        <div className="text-xs text-ink-500">
          {slots.length} {slots.length === 1 ? "pair" : "pairs"}
        </div>
      </div>

      <div className="p-3 space-y-2">
        {error && (
          <div className="text-xs text-tbc bg-tbc/10 border border-tbc/30 rounded p-2">
            {error}
          </div>
        )}

        {slots.length === 0 && (
          <div className="text-xs text-ink-500 italic px-2 py-3">
            No pairings yet.
          </div>
        )}

        {slots.map((slot) => (
          <div
            key={slot.pairing_id}
            className="flex items-center gap-2 bg-ink-900 border border-ink-800 rounded-sm px-3 py-2"
          >
            <span
              className="font-mono tabular text-sm w-6 shrink-0"
              style={{ color: team.colour_primary }}
            >
              {slot.match_order}
            </span>
            <div className="flex-1 flex flex-wrap gap-1.5">
              {slot.player_ids.map((pid) => {
                const p = playerById(pid);
                return (
                  <span
                    key={pid}
                    className="inline-flex items-center gap-1.5 h-7 px-2 rounded-full bg-ink-800 border border-ink-700 text-xs"
                  >
                    <span className="text-ink-100">
                      {p?.display_name ?? "?"}
                    </span>
                    {p?.handicap !== null && p?.handicap !== undefined && (
                      <span className="font-mono tabular text-[10px] text-ink-400">
                        {p.handicap}
                      </span>
                    )}
                    <button
                      disabled={busy}
                      onClick={() =>
                        callOverride("remove_player", {
                          pairing_id: slot.pairing_id,
                          player_id: pid,
                        })
                      }
                      className="text-ink-500 hover:text-tbc ml-0.5"
                      aria-label="Remove"
                    >
                      ×
                    </button>
                  </span>
                );
              })}
              {slot.player_ids.length < maxSize && (
                <AddPlayerPicker
                  teamPlayers={teamPlayers}
                  usedPlayerIds={usedPlayerIds}
                  onPick={(playerId) =>
                    callOverride("add_player", {
                      pairing_id: slot.pairing_id,
                      player_id: playerId,
                    })
                  }
                  busy={busy}
                />
              )}
            </div>
            <button
              disabled={busy}
              onClick={() =>
                callOverride("delete_pairing", { pairing_id: slot.pairing_id })
              }
              className="text-xs text-ink-500 hover:text-tbc px-1.5 shrink-0"
              title="Delete this pairing"
            >
              🗑
            </button>
          </div>
        ))}

        <button
          disabled={busy || slots.length >= session.match_count}
          onClick={() =>
            callOverride("add_pairing", {
              match_order: slots.length + 1,
            })
          }
          className="w-full h-9 rounded-sm border border-dashed border-ink-700 text-ink-400 text-xs hover:border-schloss hover:text-schloss-bright transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          + Add pairing slot
        </button>
      </div>
    </div>
  );
}

function AddPlayerPicker({
  teamPlayers,
  usedPlayerIds,
  onPick,
  busy,
}: {
  teamPlayers: Player[];
  usedPlayerIds: Set<string>;
  onPick: (playerId: string) => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const available = teamPlayers.filter((p) => !usedPlayerIds.has(p.id));

  if (!open) {
    return (
      <button
        disabled={busy || available.length === 0}
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center h-7 px-2.5 rounded-full border border-dashed border-ink-700 text-ink-400 text-xs hover:border-schloss hover:text-schloss-bright transition-colors disabled:opacity-30"
      >
        + add
      </button>
    );
  }

  return (
    <div className="inline-flex items-center gap-1 bg-ink-800 border border-ink-700 rounded-full px-1.5 py-0.5">
      <select
        autoFocus
        onChange={(e) => {
          if (e.target.value) {
            onPick(e.target.value);
            setOpen(false);
          }
        }}
        className="bg-ink-800 text-ink-100 text-xs border-0 outline-none px-1"
        defaultValue=""
      >
        <option value="" disabled>
          Pick…
        </option>
        {available.map((p) => (
          <option key={p.id} value={p.id}>
            {p.display_name}
            {p.handicap !== null ? ` (${p.handicap})` : ""}
          </option>
        ))}
      </select>
      <button
        onClick={() => setOpen(false)}
        className="text-ink-500 hover:text-ink-200 text-xs px-1"
      >
        ×
      </button>
    </div>
  );
}

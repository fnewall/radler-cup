"use client";

import { useState, useMemo } from "react";

type Player = {
  id: string;
  display_name: string;
  handicap: number | null;
  team_id: string;
  roster_order: number | null;
};

type Team = {
  id: string;
  name: string;
};

type Props = {
  initialPlayers: Player[];
  teams: Team[];
};

type SaveState = "idle" | "saving" | "saved" | "error";

export function PlayersEditor({ initialPlayers, teams }: Props) {
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const byTeam = useMemo(() => {
    const map: Record<string, Player[]> = {};
    for (const t of teams) map[t.id] = [];
    for (const p of players) {
      if (!map[p.team_id]) map[p.team_id] = [];
      map[p.team_id].push(p);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => {
        const ao = a.roster_order ?? 999;
        const bo = b.roster_order ?? 999;
        if (ao !== bo) return ao - bo;
        return a.display_name.localeCompare(b.display_name);
      });
    }
    return map;
  }, [players, teams]);

  const handicapTotals = useMemo(() => {
    const totals: Record<string, { total: number; hasAny: boolean }> = {};
    for (const t of teams) totals[t.id] = { total: 0, hasAny: false };
    for (const p of players) {
      if (p.handicap !== null) {
        totals[p.team_id].total += p.handicap;
        totals[p.team_id].hasAny = true;
      }
    }
    return totals;
  }, [players, teams]);

  const setState = (id: string, state: SaveState) =>
    setSaveStates((s) => ({ ...s, [id]: state }));

  async function savePlayer(id: string, patch: Partial<Player>) {
    setState(id, "saving");
    setErrors((e) => {
      const next = { ...e };
      delete next[id];
      return next;
    });

    try {
      const res = await fetch(`/api/admin/players/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");

      setPlayers((ps) =>
        ps.map((p) => (p.id === id ? { ...p, ...data } : p))
      );
      setState(id, "saved");
      setTimeout(() => {
        setState(id, "idle");
      }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed";
      setErrors((e) => ({ ...e, [id]: message }));
      setState(id, "error");
    }
  }

  function updateLocal(id: string, patch: Partial<Player>) {
    setPlayers((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function handleNameBlur(p: Player, newName: string) {
    const trimmed = newName.trim();
    if (trimmed === p.display_name || trimmed.length === 0) {
      updateLocal(p.id, { display_name: p.display_name });
      return;
    }
    savePlayer(p.id, { display_name: trimmed });
  }

  function handleHandicapBlur(p: Player, value: string) {
    const trimmed = value.trim();
    let newHcp: number | null;
    if (trimmed === "") {
      newHcp = null;
    } else {
      const num = parseFloat(trimmed);
      if (Number.isNaN(num)) {
        updateLocal(p.id, { handicap: p.handicap });
        return;
      }
      newHcp = Math.round(num * 10) / 10;
    }
    if (newHcp === p.handicap) return;
    savePlayer(p.id, { handicap: newHcp });
  }

  function handleSwap(p: Player) {
    const otherTeam = teams.find((t) => t.id !== p.team_id);
    if (!otherTeam) return;
    updateLocal(p.id, { team_id: otherTeam.id });
    savePlayer(p.id, { team_id: otherTeam.id });
  }

  const teamSlug = (team: Team): "sandbaggers" | "tbc" =>
    team.name === "Sandbaggers" ? "sandbaggers" : "tbc";

  const orderedTeams = [...teams].sort((a, b) =>
    a.name === "Sandbaggers" ? -1 : b.name === "Sandbaggers" ? 1 : 0
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
      {orderedTeams.map((team) => {
        const teamPlayers = byTeam[team.id] ?? [];
        const totals = handicapTotals[team.id];
        const slug = teamSlug(team);
        const accentClass =
          slug === "sandbaggers" ? "text-sandbaggers" : "text-tbc";

        return (
          <div key={team.id}>
            <div className="flex items-baseline justify-between mb-6 pb-4 border-b border-ink-800">
              <div>
                <div className={`text-eyebrow uppercase ${accentClass} mb-1`}>
                  Team
                </div>
                <h2 className="font-display text-3xl text-ink-100">
                  {team.name}
                </h2>
              </div>
              <div className="text-right">
                <div className="flex items-baseline gap-4 justify-end">
                  <div>
                    <div className="font-mono tabular text-xl text-ink-100">
                      {teamPlayers.length}
                    </div>
                    <div className="text-eyebrow uppercase text-ink-500">
                      Players
                    </div>
                  </div>
                  <div className="w-px h-8 bg-ink-700" />
                  <div>
                    <div className="font-mono tabular text-xl text-ink-100">
                      {totals.hasAny ? totals.total.toFixed(1) : "—"}
                    </div>
                    <div className="text-eyebrow uppercase text-ink-500">
                      HCP Total
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-px bg-ink-800 border border-ink-800 rounded-sm overflow-hidden">
              {teamPlayers.map((p) => {
                const state = saveStates[p.id] ?? "idle";
                const error = errors[p.id];
                return (
                  <div
                    key={p.id}
                    className="bg-ink-950 hover:bg-ink-900 transition-colors"
                  >
                    <div className="flex items-center gap-3 px-4 py-3">
                      <input
                        type="text"
                        defaultValue={p.display_name}
                        onBlur={(e) => handleNameBlur(p, e.target.value)}
                        className="flex-1 min-w-0 bg-transparent text-ink-100 font-medium focus:outline-none focus:bg-ink-900 px-2 py-1.5 rounded border border-transparent focus:border-ink-700"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="0.1"
                          inputMode="decimal"
                          placeholder="—"
                          defaultValue={p.handicap ?? ""}
                          onBlur={(e) => handleHandicapBlur(p, e.target.value)}
                          className="w-16 text-right font-mono tabular bg-ink-900 border border-ink-700 rounded px-2 py-1.5 text-ink-100 placeholder-ink-500 focus:outline-none focus:border-schloss-bright text-sm"
                        />
                        <button
                          onClick={() => handleSwap(p)}
                          aria-label={`Move ${p.display_name} to other team`}
                          className="text-ink-500 hover:text-schloss-bright transition-colors px-1"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M7 10l-4 4 4 4" />
                            <path d="M21 14H3" />
                            <path d="M17 4l4 4-4 4" />
                            <path d="M3 8h18" />
                          </svg>
                        </button>
                        <div
                          className={`w-1.5 h-1.5 rounded-full transition-colors ${
                            state === "saving"
                              ? "bg-schloss-bright animate-pulse"
                              : state === "saved"
                                ? "bg-schloss-bright"
                                : state === "error"
                                  ? "bg-tbc"
                                  : "bg-transparent"
                          }`}
                        />
                      </div>
                    </div>
                    {error && (
                      <div className="px-4 pb-2 text-xs text-tbc">{error}</div>
                    )}
                  </div>
                );
              })}
              {teamPlayers.length === 0 && (
                <div className="bg-ink-950 px-4 py-8 text-center text-ink-500 text-sm">
                  No players on this team
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

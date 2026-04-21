"use client";

import { useState, useMemo } from "react";

type Team = {
  id: string;
  name: string;
  display_code: string;
  display_order: number | null;
  colour_primary: string;
  colour_dark_text: string;
  colour_bg_tint: string;
  colour_border: string;
  captain_player_id: string | null;
};

type Player = {
  id: string;
  display_name: string;
  team_id: string;
};

type Props = {
  initialTeams: Team[];
  players: Player[];
};

type SaveState = "idle" | "saving" | "saved" | "error";

function SaveIndicator({ state }: { state: SaveState }) {
  return (
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
  );
}

export function TeamsEditor({ initialTeams, players }: Props) {
  const [teams, setTeams] = useState(initialTeams);
  const [states, setStates] = useState<Record<string, SaveState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const sortedTeams = useMemo(
    () =>
      [...teams].sort(
        (a, b) => (a.display_order ?? 99) - (b.display_order ?? 99)
      ),
    [teams]
  );

  const playersByTeam = useMemo(() => {
    const map: Record<string, Player[]> = {};
    for (const p of players) {
      if (!map[p.team_id]) map[p.team_id] = [];
      map[p.team_id].push(p);
    }
    for (const arr of Object.values(map)) {
      arr.sort((a, b) => a.display_name.localeCompare(b.display_name));
    }
    return map;
  }, [players]);

  async function saveTeam(id: string, patch: Partial<Team>) {
    setStates((s) => ({ ...s, [id]: "saving" }));
    setErrors((e) => ({ ...e, [id]: "" }));

    try {
      const res = await fetch(`/api/admin/teams/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");

      setTeams((ts) => ts.map((t) => (t.id === id ? { ...t, ...data } : t)));
      setStates((s) => ({ ...s, [id]: "saved" }));
      setTimeout(() => setStates((s) => ({ ...s, [id]: "idle" })), 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setErrors((e) => ({ ...e, [id]: msg }));
      setStates((s) => ({ ...s, [id]: "error" }));
    }
  }

  async function swapOrder() {
    if (sortedTeams.length !== 2) return;
    const [first, second] = sortedTeams;
    // Use temp value to avoid the unique-ish collision feel
    await Promise.all([
      saveTeam(first.id, { display_order: 2 }),
      saveTeam(second.id, { display_order: 1 }),
    ]);
  }

  return (
    <div className="space-y-6">
      {/* Order control */}
      {sortedTeams.length === 2 && (
        <div className="flex items-center justify-between bg-ink-950 border border-ink-800 rounded-sm p-4">
          <div>
            <div className="text-eyebrow uppercase text-ink-500 mb-1">
              Home page order
            </div>
            <div className="text-sm text-ink-200">
              <span className="text-ink-100 font-medium">{sortedTeams[0].name}</span>{" "}
              on the left ·{" "}
              <span className="text-ink-100 font-medium">{sortedTeams[1].name}</span>{" "}
              on the right
            </div>
          </div>
          <button
            onClick={swapOrder}
            className="h-10 px-4 rounded-md border border-ink-700 text-ink-200 hover:border-schloss-bright hover:text-ink-100 transition-colors text-sm flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M7 10l-4 4 4 4" />
              <path d="M21 14H3" />
              <path d="M17 4l4 4-4 4" />
              <path d="M3 8h18" />
            </svg>
            Swap order
          </button>
        </div>
      )}

      {sortedTeams.map((team) => {
        const state = states[team.id] ?? "idle";
        const error = errors[team.id];
        const teamPlayers = playersByTeam[team.id] ?? [];
        const captain = teamPlayers.find((p) => p.id === team.captain_player_id);

        return (
          <div
            key={team.id}
            className="bg-ink-950 border border-ink-800 rounded-sm overflow-hidden"
          >
            <div
              className="h-1 w-full"
              style={{ backgroundColor: team.colour_primary }}
            />

            <div className="p-6 md:p-8">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-ink-800">
                <div className="flex items-baseline gap-4">
                  <div
                    className="font-mono tabular text-2xl font-light"
                    style={{ color: team.colour_primary }}
                  >
                    {team.display_code}
                  </div>
                  <div>
                    <div className="text-ink-100 font-medium">{team.name}</div>
                    <div className="text-xs text-ink-400 mt-0.5">
                      Captain: {captain?.display_name ?? "—"} · Position{" "}
                      {team.display_order ?? "—"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {error && <div className="text-xs text-tbc">{error}</div>}
                  <SaveIndicator state={state} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field label="Team name">
                  <input
                    type="text"
                    defaultValue={team.name}
                    key={`name-${team.name}`}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== team.name) saveTeam(team.id, { name: v });
                    }}
                    className={inputClass}
                  />
                </Field>
                <Field label="Display code (1–3 letters)">
                  <input
                    type="text"
                    maxLength={3}
                    defaultValue={team.display_code}
                    key={`code-${team.display_code}`}
                    onBlur={(e) => {
                      const v = e.target.value.trim().toUpperCase();
                      if (v && v !== team.display_code) {
                        saveTeam(team.id, { display_code: v });
                      }
                    }}
                    className={inputClass}
                  />
                </Field>
                <Field label="Captain">
                  <select
                    value={team.captain_player_id ?? ""}
                    onChange={(e) => {
                      const v = e.target.value || null;
                      if (v !== team.captain_player_id) {
                        saveTeam(team.id, { captain_player_id: v });
                      }
                    }}
                    className={inputClass}
                  >
                    <option value="">— none —</option>
                    {teamPlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.display_name}
                      </option>
                    ))}
                  </select>
                </Field>
                <div />

                <ColourField
                  label="Primary"
                  value={team.colour_primary}
                  onChange={(v) => saveTeam(team.id, { colour_primary: v })}
                />
                <ColourField
                  label="Border accent"
                  value={team.colour_border}
                  onChange={(v) => saveTeam(team.id, { colour_border: v })}
                />
                <ColourField
                  label="Dark text (on light bg)"
                  value={team.colour_dark_text}
                  onChange={(v) => saveTeam(team.id, { colour_dark_text: v })}
                />
                <ColourField
                  label="Background tint"
                  value={team.colour_bg_tint}
                  onChange={(v) => saveTeam(team.id, { colour_bg_tint: v })}
                />
              </div>

              <div className="mt-6 pt-5 border-t border-ink-800 flex items-center gap-3">
                <div className="text-eyebrow uppercase text-ink-500">Preview</div>
                <div
                  className="flex items-center gap-3 px-4 py-2 rounded"
                  style={{
                    backgroundColor: team.colour_bg_tint,
                    border: `1px solid ${team.colour_border}`,
                  }}
                >
                  <span
                    className="font-mono tabular text-sm font-medium"
                    style={{ color: team.colour_primary }}
                  >
                    {team.display_code}
                  </span>
                  <span
                    className="text-sm font-medium"
                    style={{ color: team.colour_dark_text }}
                  >
                    {team.name}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-eyebrow uppercase text-ink-500 block mb-2">
        {label}
      </span>
      {children}
    </label>
  );
}

// Colour field — uses `key={value}` to force remount when the saved value
// changes, so the colour picker swatch and hex text always reflect the DB.
function ColourField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-eyebrow uppercase text-ink-500 block mb-2">
        {label}
      </span>
      <ColourInner key={value} value={value} onChange={onChange} />
    </label>
  );
}

function ColourInner({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [local, setLocal] = useState(value);

  function commit(v: string) {
    const trimmed = v.trim();
    if (/^#([0-9A-Fa-f]{6})$/.test(trimmed) && trimmed.toLowerCase() !== value.toLowerCase()) {
      onChange(trimmed);
    } else if (!/^#([0-9A-Fa-f]{6})$/.test(trimmed)) {
      setLocal(value); // revert invalid input
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        className="h-11 w-11 rounded cursor-pointer bg-ink-900 border border-ink-700"
      />
      <input
        type="text"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => commit(local)}
        className="w-full h-11 px-3 bg-ink-900 border border-ink-700 rounded text-ink-100 focus:outline-none focus:border-schloss-bright transition-colors text-sm font-mono tabular uppercase"
        placeholder="#RRGGBB"
      />
    </div>
  );
}

const inputClass =
  "w-full h-11 px-3 bg-ink-900 border border-ink-700 rounded text-ink-100 focus:outline-none focus:border-schloss-bright transition-colors text-sm";

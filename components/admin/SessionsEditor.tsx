"use client";

import { useState, useCallback } from "react";
import { viennaLocalToIso, isoToViennaLocal, formatViennaDisplay } from "@/lib/timezone";

type Tournament = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  points_to_win: number;
  points_to_tie: number;
  tiebreaker_rule: string | null;
};

type Allowance =
  | { type: "combined_diff"; pct: number }
  | { type: "individual"; pct: number }
  | { type: "split"; low_pct: number; high_pct: number }
  | { type: "individual_diff"; pct: number }
  | { type: "flat"; pct: number };

type Session = {
  id: string;
  session_number: number;
  label: string;
  day_number: number;
  start_at: string | null;
  format: "foursomes" | "betterball" | "greensomes" | "scramble_2v2" | "singles";
  match_count: number;
  points_per_match: number;
  tees_used: string | null;
  handicap_allowance: Allowance | Record<string, never>;
};

type Tees = { name: string };

type Props = {
  tournament: Tournament;
  sessions: Session[];
  tees: Tees[];
};

type SaveState = "idle" | "saving" | "saved" | "error";

const FORMAT_LABELS: Record<Session["format"], string> = {
  foursomes: "Foursomes",
  betterball: "Betterball",
  greensomes: "Greensomes",
  scramble_2v2: "Scramble 2v2",
  singles: "Singles",
};

const ALLOWANCE_TYPE_LABELS: Record<Allowance["type"], string> = {
  combined_diff: "Combined difference",
  individual: "Per player",
  split: "Split (low / high)",
  individual_diff: "Individual difference",
  flat: "Flat combined",
};

function allowanceSummary(a: Session["handicap_allowance"]): string {
  if (!a || !("type" in a)) return "—";
  switch (a.type) {
    case "split":
      return `${a.low_pct}% low · ${a.high_pct}% high`;
    default:
      return `${a.pct}% · ${ALLOWANCE_TYPE_LABELS[a.type]}`;
  }
}

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

export function SessionsEditor({ tournament: t0, sessions: s0, tees }: Props) {
  const [tournament, setTournament] = useState(t0);
  const [sessions, setSessions] = useState(s0);
  const [states, setStates] = useState<Record<string, SaveState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setState = (key: string, s: SaveState) =>
    setStates((st) => ({ ...st, [key]: s }));

  const showSaved = useCallback((key: string) => {
    setState(key, "saved");
    setTimeout(() => setState(key, "idle"), 1500);
  }, []);

  async function saveTournament(patch: Partial<Tournament>) {
    const key = "tournament";
    setState(key, "saving");
    setErrors((e) => ({ ...e, [key]: "" }));

    try {
      const res = await fetch("/api/admin/tournament", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setTournament((prev) => ({ ...prev, ...data }));
      showSaved(key);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setErrors((e) => ({ ...e, [key]: msg }));
      setState(key, "error");
    }
  }

  async function saveSession(id: string, patch: Partial<Session>) {
    setState(id, "saving");
    setErrors((e) => ({ ...e, [id]: "" }));

    try {
      const res = await fetch(`/api/admin/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setSessions((ss) =>
        ss.map((s) => (s.id === id ? { ...s, ...data } : s))
      );
      showSaved(id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setErrors((e) => ({ ...e, [id]: msg }));
      setState(id, "error");
    }
  }

  const tState = states.tournament ?? "idle";
  const tErr = errors.tournament;

  return (
    <div className="space-y-12">
      {/* Tournament card */}
      <div className="bg-ink-950 border border-ink-800 rounded-sm p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="text-eyebrow uppercase text-schloss-bright">
              Tournament
            </div>
            <SaveIndicator state={tState} />
          </div>
          {tErr && <div className="text-xs text-tbc">{tErr}</div>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Name">
            <input
              type="text"
              defaultValue={tournament.name}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== tournament.name) saveTournament({ name: v });
              }}
              className={inputClass}
            />
          </Field>
          <div />
          <Field label="Start date">
            <input
              type="date"
              defaultValue={tournament.start_date ?? ""}
              onBlur={(e) => {
                const v = e.target.value || null;
                if (v !== tournament.start_date) saveTournament({ start_date: v });
              }}
              className={inputClass}
            />
          </Field>
          <Field label="End date">
            <input
              type="date"
              defaultValue={tournament.end_date ?? ""}
              onBlur={(e) => {
                const v = e.target.value || null;
                if (v !== tournament.end_date) saveTournament({ end_date: v });
              }}
              className={inputClass}
            />
          </Field>
          <Field label="Points to win">
            <input
              type="number"
              step="0.5"
              defaultValue={tournament.points_to_win}
              onBlur={(e) => {
                const v = parseFloat(e.target.value);
                if (!Number.isNaN(v) && v !== tournament.points_to_win) {
                  saveTournament({ points_to_win: v });
                }
              }}
              className={inputClass}
            />
          </Field>
          <Field label="Points to tie">
            <input
              type="number"
              step="0.5"
              defaultValue={tournament.points_to_tie}
              onBlur={(e) => {
                const v = parseFloat(e.target.value);
                if (!Number.isNaN(v) && v !== tournament.points_to_tie) {
                  saveTournament({ points_to_tie: v });
                }
              }}
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      {/* Sessions */}
      <div>
        <div className="flex items-baseline justify-between mb-6">
          <div className="text-eyebrow uppercase text-schloss-bright">
            Sessions · {sessions.length}
          </div>
          <div className="text-xs text-ink-500">
            Times are Europe/Vienna (CEST in summer)
          </div>
        </div>

        <div className="space-y-4">
          {sessions
            .sort((a, b) => a.session_number - b.session_number)
            .map((s) => {
              const state = states[s.id] ?? "idle";
              const error = errors[s.id];
              const display = formatViennaDisplay(s.start_at);
              const allowanceDisplay = allowanceSummary(s.handicap_allowance);

              return (
                <div
                  key={s.id}
                  className="bg-ink-950 border border-ink-800 rounded-sm p-6"
                >
                  <div className="flex items-center justify-between mb-5 pb-4 border-b border-ink-800">
                    <div className="flex items-baseline gap-4">
                      <div className="font-mono tabular text-2xl text-schloss-bright font-light">
                        {String(s.session_number).padStart(2, "0")}
                      </div>
                      <div>
                        <div className="text-ink-100 font-medium">
                          {s.label}
                        </div>
                        <div className="text-xs text-ink-400 mt-0.5">
                          {display} · {allowanceDisplay}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {error && <div className="text-xs text-tbc">{error}</div>}
                      <SaveIndicator state={state} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Label">
                      <input
                        type="text"
                        defaultValue={s.label}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v && v !== s.label) saveSession(s.id, { label: v });
                        }}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Start (Vienna local)">
                      <input
                        type="datetime-local"
                        defaultValue={isoToViennaLocal(s.start_at)}
                        onBlur={(e) => {
                          const v = e.target.value;
                          if (!v) {
                            if (s.start_at !== null) saveSession(s.id, { start_at: null });
                            return;
                          }
                          const iso = viennaLocalToIso(v);
                          if (iso && iso !== s.start_at) {
                            saveSession(s.id, { start_at: iso });
                          }
                        }}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Format">
                      <select
                        defaultValue={s.format}
                        onChange={(e) => {
                          const v = e.target.value as Session["format"];
                          if (v !== s.format) saveSession(s.id, { format: v });
                        }}
                        className={inputClass}
                      >
                        {Object.entries(FORMAT_LABELS).map(([k, label]) => (
                          <option key={k} value={k}>{label}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Tees">
                      <select
                        defaultValue={s.tees_used ?? ""}
                        onChange={(e) => {
                          const v = e.target.value || null;
                          if (v !== s.tees_used) saveSession(s.id, { tees_used: v });
                        }}
                        className={inputClass}
                      >
                        <option value="">—</option>
                        {tees.map((t) => (
                          <option key={t.name} value={t.name}>{t.name}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Matches">
                      <input
                        type="number"
                        min={1}
                        max={24}
                        defaultValue={s.match_count}
                        onBlur={(e) => {
                          const v = parseInt(e.target.value, 10);
                          if (!Number.isNaN(v) && v !== s.match_count) {
                            saveSession(s.id, { match_count: v });
                          }
                        }}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Points per match">
                      <input
                        type="number"
                        step="0.5"
                        min={0.5}
                        max={10}
                        defaultValue={s.points_per_match}
                        onBlur={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!Number.isNaN(v) && v !== s.points_per_match) {
                            saveSession(s.id, { points_per_match: v });
                          }
                        }}
                        className={inputClass}
                      />
                    </Field>
                  </div>

                  <AllowanceEditor
                    allowance={s.handicap_allowance as Allowance | undefined}
                    format={s.format}
                    onSave={(a) => saveSession(s.id, { handicap_allowance: a })}
                  />
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

function AllowanceEditor({
  allowance,
  format,
  onSave,
}: {
  allowance: Allowance | undefined;
  format: Session["format"];
  onSave: (a: Allowance) => void;
}) {
  const initial: Allowance = allowance && "type" in allowance
    ? allowance
    : { type: "flat", pct: 100 };

  const [type, setType] = useState<Allowance["type"]>(initial.type);
  const [pct, setPct] = useState<number>(
    initial.type === "split" ? 50 : initial.pct
  );
  const [lowPct, setLowPct] = useState<number>(
    initial.type === "split" ? initial.low_pct : 60
  );
  const [highPct, setHighPct] = useState<number>(
    initial.type === "split" ? initial.high_pct : 40
  );

  function commit() {
    const next: Allowance =
      type === "split"
        ? { type: "split", low_pct: lowPct, high_pct: highPct }
        : ({ type, pct } as Allowance);

    // Only save if different
    const same =
      allowance && "type" in allowance &&
      allowance.type === next.type &&
      (next.type === "split"
        ? allowance.type === "split" &&
          allowance.low_pct === next.low_pct &&
          allowance.high_pct === next.high_pct
        : "pct" in allowance && (allowance as { pct: number }).pct === (next as { pct: number }).pct);

    if (!same) onSave(next);
  }

  function applyTraditional() {
    let next: Allowance;
    switch (format) {
      case "foursomes":
        next = { type: "combined_diff", pct: 50 };
        break;
      case "betterball":
        next = { type: "individual", pct: 85 };
        break;
      case "greensomes":
        next = { type: "split", low_pct: 60, high_pct: 40 };
        break;
      case "scramble_2v2":
        next = { type: "split", low_pct: 35, high_pct: 15 };
        break;
      case "singles":
        next = { type: "individual_diff", pct: 100 };
        break;
    }
    setType(next.type);
    if (next.type === "split") {
      setLowPct(next.low_pct);
      setHighPct(next.high_pct);
    } else {
      setPct(next.pct);
    }
    onSave(next);
  }

  function applyFlat75() {
    const next: Allowance = { type: "flat", pct: 75 };
    setType("flat");
    setPct(75);
    onSave(next);
  }

  return (
    <div className="mt-6 pt-5 border-t border-ink-800">
      <div className="flex items-center justify-between mb-4">
        <div className="text-eyebrow uppercase text-ink-500">
          Handicap Allowance
        </div>
        <div className="flex gap-2">
          <button
            onClick={applyTraditional}
            className="h-8 px-3 rounded border border-ink-700 text-ink-300 hover:text-ink-100 hover:border-ink-500 transition-colors text-xs"
          >
            R&amp;A default
          </button>
          <button
            onClick={applyFlat75}
            className="h-8 px-3 rounded border border-ink-700 text-ink-300 hover:text-ink-100 hover:border-ink-500 transition-colors text-xs"
          >
            Flat 75%
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Type">
          <select
            value={type}
            onChange={(e) => {
              const t = e.target.value as Allowance["type"];
              setType(t);
              // Commit after state settles
              setTimeout(() => {
                const next: Allowance =
                  t === "split"
                    ? { type: "split", low_pct: lowPct, high_pct: highPct }
                    : ({ type: t, pct } as Allowance);
                onSave(next);
              }, 0);
            }}
            className={inputClass}
          >
            {Object.entries(ALLOWANCE_TYPE_LABELS).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
        </Field>

        {type === "split" ? (
          <>
            <Field label="Low HCP %">
              <input
                type="number"
                min={0}
                max={200}
                value={lowPct}
                onChange={(e) => setLowPct(parseFloat(e.target.value) || 0)}
                onBlur={commit}
                className={inputClass}
              />
            </Field>
            <Field label="High HCP %">
              <input
                type="number"
                min={0}
                max={200}
                value={highPct}
                onChange={(e) => setHighPct(parseFloat(e.target.value) || 0)}
                onBlur={commit}
                className={inputClass}
              />
            </Field>
          </>
        ) : (
          <Field label="Percentage">
            <input
              type="number"
              min={0}
              max={200}
              value={pct}
              onChange={(e) => setPct(parseFloat(e.target.value) || 0)}
              onBlur={commit}
              className={inputClass}
            />
          </Field>
        )}
      </div>

      <p className="text-xs text-ink-500 mt-3 leading-relaxed">
        {type === "combined_diff" && "Applied to the pair's combined handicap difference (e.g. Foursomes default)."}
        {type === "individual" && "Applied to each player's individual handicap (e.g. Betterball default)."}
        {type === "split" && "Different % for the stronger and weaker handicaps in a pair (e.g. Greensomes default)."}
        {type === "individual_diff" && "Applied to the difference between two players' handicaps (e.g. Singles default)."}
        {type === "flat" && "Single % applied uniformly across the pair's combined handicap."}
      </p>
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

const inputClass =
  "w-full h-11 px-3 bg-ink-900 border border-ink-700 rounded text-ink-100 focus:outline-none focus:border-schloss-bright transition-colors text-sm";

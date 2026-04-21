"use client";

import { useState } from "react";

type Tournament = {
  id: string;
  tiebreaker_rule: string | null;
  max_strokes_per_hole: number | null;
  end_match_early: boolean;
  concession_enabled: boolean;
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

export function RulesEditor({ tournament: t0 }: { tournament: Tournament }) {
  const [t, setT] = useState(t0);
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  async function save(patch: Partial<Tournament>) {
    setState("saving");
    setError(null);
    try {
      const res = await fetch("/api/admin/tournament", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setT((prev) => ({ ...prev, ...data }));
      setState("saved");
      setTimeout(() => setState("idle"), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setState("error");
    }
  }

  return (
    <div className="space-y-6">
      {/* Max strokes */}
      <div className="bg-ink-950 border border-ink-800 rounded-sm p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-eyebrow uppercase text-schloss-bright mb-1">
              Strokes Cap
            </div>
            <div className="text-ink-100 font-medium">
              Max strokes received per hole
            </div>
            <div className="text-xs text-ink-400 mt-1 max-w-md leading-relaxed">
              Applied <em>after</em>{" "}
              the session&apos;s handicap allowance. Leave blank for no cap.
              Common values: 1 or 2.
            </div>
          </div>
          <SaveIndicator state={state} />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={t.max_strokes_per_hole === null ? "" : String(t.max_strokes_per_hole)}
            onChange={(e) => {
              const v = e.target.value === "" ? null : parseInt(e.target.value, 10);
              save({ max_strokes_per_hole: v });
            }}
            className={`${inputClass} max-w-[160px]`}
          >
            <option value="">No cap</option>
            <option value="1">1 stroke</option>
            <option value="2">2 strokes</option>
            <option value="3">3 strokes</option>
            <option value="4">4 strokes</option>
          </select>
          <div className="text-xs text-ink-500">
            Current:{" "}
            <span className="text-ink-200 font-mono tabular">
              {t.max_strokes_per_hole === null ? "none" : `${t.max_strokes_per_hole}`}
            </span>
          </div>
        </div>
      </div>

      {/* End match early */}
      <ToggleRow
        label="End match early"
        eyebrow="Match Play"
        hint="When on, a match ends as soon as it's mathematically decided (e.g. 4&3). Off: all matches play out 18 holes."
        value={t.end_match_early}
        onChange={(v) => save({ end_match_early: v })}
      />

      {/* Concessions */}
      <ToggleRow
        label="Allow hole concessions"
        eyebrow="Match Play"
        hint="Lets any player tap &ldquo;Concede hole&rdquo; during score entry to give the hole to the opposing team without entering scores."
        value={t.concession_enabled}
        onChange={(v) => save({ concession_enabled: v })}
      />

      {/* Tiebreaker */}
      <div className="bg-ink-950 border border-ink-800 rounded-sm p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-eyebrow uppercase text-schloss-bright mb-1">
              Tie Break
            </div>
            <div className="text-ink-100 font-medium">
              Tiebreaker rule (at 18–18)
            </div>
            <div className="text-xs text-ink-400 mt-1 max-w-md leading-relaxed">
              Free text. Shown on the leaderboard if the final score is a tie.
              Examples: &ldquo;Holder retains the cup&rdquo;, &ldquo;Most
              singles matches won&rdquo;, &ldquo;Captain&apos;s playoff&rdquo;.
            </div>
          </div>
        </div>
        <textarea
          defaultValue={t.tiebreaker_rule ?? ""}
          onBlur={(e) => {
            const v = e.target.value.trim() || null;
            if (v !== t.tiebreaker_rule) save({ tiebreaker_rule: v });
          }}
          rows={3}
          className="w-full p-3 bg-ink-900 border border-ink-700 rounded text-ink-100 placeholder-ink-500 focus:outline-none focus:border-schloss-bright transition-colors text-sm"
          placeholder="e.g. Holder retains the cup on 18–18."
        />
      </div>

      {error && (
        <div className="text-sm text-tbc">Error: {error}</div>
      )}
    </div>
  );
}

function ToggleRow({
  label,
  eyebrow,
  hint,
  value,
  onChange,
}: {
  label: string;
  eyebrow: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="bg-ink-950 border border-ink-800 rounded-sm p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="text-eyebrow uppercase text-schloss-bright mb-1">
            {eyebrow}
          </div>
          <div className="text-ink-100 font-medium">{label}</div>
          <div className="text-xs text-ink-400 mt-1 max-w-md leading-relaxed">
            {hint}
          </div>
        </div>
        <button
          onClick={() => onChange(!value)}
          role="switch"
          aria-checked={value}
          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors shrink-0 ${
            value ? "bg-schloss" : "bg-ink-800 border border-ink-700"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
              value ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
}

const inputClass =
  "h-11 px-3 bg-ink-900 border border-ink-700 rounded text-ink-100 focus:outline-none focus:border-schloss-bright transition-colors text-sm";

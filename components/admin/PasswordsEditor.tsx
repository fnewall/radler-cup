"use client";

import { useState } from "react";

type Password = {
  id: string;
  role: "player" | "captain" | "admin";
  scope: string | null;
  description: string | null;
};

type Team = {
  id: string;
  name: string;
};

type Props = {
  passwords: Password[];
  teams: Team[];
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

function passwordLabel(p: Password, teams: Team[]): string {
  if (p.role === "admin") return "Admin";
  if (p.role === "player") return "Player PIN";
  if (p.role === "captain") {
    const team = teams.find((t) => t.id === p.scope);
    return team ? `${team.name} captain` : "Captain";
  }
  return "Password";
}

function passwordHint(role: Password["role"]): string {
  if (role === "admin") return "Full control over players, teams, course, sessions, scores, and passwords.";
  if (role === "player") return "Shared PIN for all 24 players. Used to enter scores.";
  return "Sign in to submit that team's pairings before each session.";
}

export function PasswordsEditor({ passwords, teams }: Props) {
  const [states, setStates] = useState<Record<string, SaveState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [reveal, setReveal] = useState<Record<string, boolean>>({});

  // View state for the current-passwords section
  const [viewLoaded, setViewLoaded] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [plaintext, setPlaintext] = useState<Record<string, string | null>>({});
  const [copied, setCopied] = useState<string | null>(null);

  async function loadPlaintext() {
    setViewLoading(true);
    try {
      const res = await fetch("/api/admin/passwords/reveal", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setPlaintext(data.passwords ?? {});
        setViewLoaded(true);
      }
    } finally {
      setViewLoading(false);
    }
  }

  async function copyValue(id: string, val: string) {
    try {
      await navigator.clipboard.writeText(val);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // ignore
    }
  }

  async function save(id: string) {
    const pw = values[id]?.trim();
    if (!pw) return;
    if (pw.length < 4) {
      setErrors((e) => ({ ...e, [id]: "Too short — 4 characters minimum." }));
      return;
    }

    setStates((s) => ({ ...s, [id]: "saving" }));
    setErrors((e) => ({ ...e, [id]: "" }));

    try {
      const res = await fetch("/api/admin/passwords", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password_id: id, new_password: pw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");

      setStates((s) => ({ ...s, [id]: "saved" }));
      setValues((v) => ({ ...v, [id]: "" }));
      setReveal((r) => ({ ...r, [id]: false }));
      // Optimistically update the plaintext cache if it's loaded
      if (viewLoaded) {
        setPlaintext((p) => ({ ...p, [id]: pw }));
      }
      setTimeout(() => setStates((s) => ({ ...s, [id]: "idle" })), 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setErrors((e) => ({ ...e, [id]: msg }));
      setStates((s) => ({ ...s, [id]: "error" }));
    }
  }

  const sorted = [...passwords].sort((a, b) => {
    const order = { admin: 0, player: 1, captain: 2 } as const;
    if (order[a.role] !== order[b.role]) return order[a.role] - order[b.role];
    if (a.role === "captain" && b.role === "captain") {
      const nameA = teams.find((t) => t.id === a.scope)?.name ?? "";
      const nameB = teams.find((t) => t.id === b.scope)?.name ?? "";
      return nameA.localeCompare(nameB);
    }
    return 0;
  });

  const anyMissing = sorted.some(
    (p) => viewLoaded && (plaintext[p.id] === null || plaintext[p.id] === undefined)
  );

  return (
    <div className="space-y-6">
      {/* Current passwords — gated */}
      <div className="bg-ink-950 border border-ink-800 rounded-sm overflow-hidden">
        <div className="p-5 border-b border-ink-800 flex items-center justify-between">
          <div>
            <div className="text-eyebrow uppercase text-schloss-bright mb-1">
              Current Passwords
            </div>
            <div className="text-xs text-ink-400 leading-relaxed max-w-md">
              Plaintext values are stored only for admin reference. Don&apos;t show this screen to anyone you wouldn&apos;t give all four passwords to.
            </div>
          </div>
          {viewLoaded ? (
            <button
              onClick={() => {
                setViewLoaded(false);
                setPlaintext({});
              }}
              className="h-10 px-4 rounded border border-ink-700 text-ink-300 hover:text-ink-100 hover:border-ink-500 transition-colors text-sm"
            >
              Hide
            </button>
          ) : (
            <button
              onClick={loadPlaintext}
              disabled={viewLoading}
              className="h-10 px-4 rounded bg-schloss text-white hover:bg-schloss-bright transition-colors text-sm font-medium disabled:opacity-50"
            >
              {viewLoading ? "Loading…" : "Show passwords"}
            </button>
          )}
        </div>

        {viewLoaded && (
          <div className="divide-y divide-ink-800">
            {sorted.map((p) => {
              const val = plaintext[p.id];
              const wasCopied = copied === p.id;
              return (
                <div
                  key={p.id}
                  className="px-5 py-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="text-xs text-ink-400 uppercase tracking-wide mb-0.5">
                      {passwordLabel(p, teams)}
                    </div>
                    {val ? (
                      <div className="font-mono tabular text-ink-100 text-sm truncate">
                        {val}
                      </div>
                    ) : (
                      <div className="text-xs text-ink-500 italic">
                        Not yet available — change this password below to store it.
                      </div>
                    )}
                  </div>
                  {val && (
                    <button
                      onClick={() => copyValue(p.id, val)}
                      className="shrink-0 h-9 px-3 rounded border border-ink-700 text-ink-300 hover:text-schloss-bright hover:border-schloss-bright transition-colors text-xs"
                    >
                      {wasCopied ? "Copied ✓" : "Copy"}
                    </button>
                  )}
                </div>
              );
            })}

            {anyMissing && (
              <div className="px-5 py-3 bg-ink-900 text-xs text-ink-400 leading-relaxed">
                Passwords set before this feature existed can&apos;t be recovered — the hashes are one-way. Use &ldquo;Change&rdquo; below to set a new value and it&apos;ll appear here.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Change passwords */}
      <div className="bg-ink-950 border border-ink-800 rounded-sm p-5 text-sm text-ink-300 leading-relaxed">
        Setting a new password immediately invalidates the old one on every device.
      </div>

      {sorted.map((p) => {
        const state = states[p.id] ?? "idle";
        const error = errors[p.id];
        const value = values[p.id] ?? "";
        const isRevealed = reveal[p.id] ?? false;

        return (
          <div
            key={p.id}
            className="bg-ink-950 border border-ink-800 rounded-sm p-6"
          >
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="text-eyebrow uppercase text-schloss-bright mb-1">
                  {p.role}
                </div>
                <div className="text-ink-100 font-medium">
                  {passwordLabel(p, teams)}
                </div>
                <div className="text-xs text-ink-400 mt-1 max-w-md leading-relaxed">
                  {passwordHint(p.role)}
                </div>
              </div>
              <SaveIndicator state={state} />
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <input
                  type={isRevealed ? "text" : "password"}
                  placeholder="New password"
                  value={value}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [p.id]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") save(p.id);
                  }}
                  className="w-full h-11 px-3 pr-10 bg-ink-900 border border-ink-700 rounded text-ink-100 placeholder-ink-500 focus:outline-none focus:border-schloss-bright transition-colors text-sm"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() =>
                    setReveal((r) => ({ ...r, [p.id]: !isRevealed }))
                  }
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-ink-400 hover:text-ink-100 transition-colors"
                  aria-label={isRevealed ? "Hide" : "Show"}
                >
                  {isRevealed ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              <button
                onClick={() => save(p.id)}
                disabled={!value.trim() || state === "saving"}
                className="h-11 px-6 rounded bg-schloss text-white hover:bg-schloss-bright transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {state === "saving" ? "Saving…" : state === "saved" ? "Saved ✓" : "Change"}
              </button>
            </div>

            {error && (
              <div className="mt-3 text-xs text-tbc">{error}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

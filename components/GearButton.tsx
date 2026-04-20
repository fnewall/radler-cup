"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

export function GearButton() {
  const { role, login, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
    setPassword("");
    setError(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setSubmitting(true);
    setError(null);

    const result = await login(password.trim());
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    close();

    if (result.role === "admin") router.push("/admin");
    else if (result.role === "captain") router.push("/captain");
  }

  async function handleLogout() {
    await logout();
    close();
    router.refresh();
  }

  return (
    <>
      <button
        aria-label={role ? `Signed in as ${role}` : "Settings"}
        onClick={() => setOpen(true)}
        className={`w-9 h-9 rounded-full border flex items-center justify-center transition-colors ${
          role
            ? "border-schloss bg-schloss-tint text-schloss-bright hover:border-schloss-bright"
            : "border-ink-700 text-ink-300 hover:border-ink-500 hover:text-ink-100"
        }`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={close}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-sm bg-ink-900 border border-ink-700 rounded-md p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-eyebrow uppercase text-schloss-bright mb-2">
              {role ? "Signed In" : "Access"}
            </div>
            <h2 className="font-display text-2xl text-ink-100 mb-6">
              {role
                ? role === "admin"
                  ? "Admin"
                  : role === "captain"
                    ? "Captain"
                    : "Player"
                : "Enter password"}
            </h2>

            {role ? (
              <div className="space-y-6">
                <p className="text-sm text-ink-300">
                  You are signed in as <span className="text-ink-100">{role}</span>.
                  Close this or sign out below.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={close}
                    className="flex-1 h-11 rounded-md border border-ink-700 text-ink-200 hover:border-ink-500 hover:text-ink-100 transition-colors text-sm"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex-1 h-11 rounded-md bg-ink-800 text-ink-200 hover:bg-ink-700 transition-colors text-sm"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  type="password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password or PIN"
                  className="w-full h-12 px-4 bg-ink-950 border border-ink-700 rounded-md text-ink-100 placeholder-ink-500 focus:border-schloss-bright focus:outline-none transition-colors"
                  autoComplete="current-password"
                />
                {error && (
                  <div className="text-sm text-tbc">{error}</div>
                )}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={close}
                    className="flex-1 h-11 rounded-md border border-ink-700 text-ink-200 hover:border-ink-500 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !password.trim()}
                    className="flex-1 h-11 rounded-md bg-schloss text-white hover:bg-schloss-bright transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? "Checking..." : "Enter"}
                  </button>
                </div>
                <p className="text-xs text-ink-500 pt-2">
                  Players, captains, and admin use the same prompt — we&apos;ll recognise which password you entered.
                </p>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

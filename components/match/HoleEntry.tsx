"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { TeamEntry, ExistingScore } from "@/lib/queries/holeEntry";

type Format = "foursomes" | "betterball" | "greensomes" | "scramble_2v2" | "singles";

type Props = {
  matchId: string;
  holeNumber: number;
  par: number;
  format: Format;
  teamA: TeamEntry;
  teamB: TeamEntry;
  existingScore: ExistingScore | null;
  concessionEnabled: boolean;
  prevHole: number | null;
  nextHole: number | null;
};

type PairScores = {
  team_a_gross: string;
  team_b_gross: string;
};

type BetterballScores = {
  team_a_p1_gross: string;
  team_a_p2_gross: string;
  team_b_p1_gross: string;
  team_b_p2_gross: string;
};

function extractExistingPairScores(
  existing: ExistingScore | null
): PairScores {
  if (!existing) return { team_a_gross: "", team_b_gross: "" };
  const s = existing.scores as {
    team_a?: { gross?: number | null };
    team_b?: { gross?: number | null };
  };
  return {
    team_a_gross: s.team_a?.gross != null ? String(s.team_a.gross) : "",
    team_b_gross: s.team_b?.gross != null ? String(s.team_b.gross) : "",
  };
}

function extractExistingBetterball(
  existing: ExistingScore | null
): BetterballScores {
  if (!existing) {
    return {
      team_a_p1_gross: "",
      team_a_p2_gross: "",
      team_b_p1_gross: "",
      team_b_p2_gross: "",
    };
  }
  const s = existing.scores as {
    team_a?: { p1_gross?: number | null; p2_gross?: number | null };
    team_b?: { p1_gross?: number | null; p2_gross?: number | null };
  };
  return {
    team_a_p1_gross: s.team_a?.p1_gross != null ? String(s.team_a.p1_gross) : "",
    team_a_p2_gross: s.team_a?.p2_gross != null ? String(s.team_a.p2_gross) : "",
    team_b_p1_gross: s.team_b?.p1_gross != null ? String(s.team_b.p1_gross) : "",
    team_b_p2_gross: s.team_b?.p2_gross != null ? String(s.team_b.p2_gross) : "",
  };
}

function extractConcededTo(
  existing: ExistingScore | null
): "team_a" | "team_b" | null {
  if (!existing) return null;
  if (existing.result === "conceded_to_a") return "team_a";
  if (existing.result === "conceded_to_b") return "team_b";
  return null;
}

export function HoleEntry({
  matchId,
  holeNumber,
  par,
  format,
  teamA,
  teamB,
  existingScore,
  concessionEnabled,
  prevHole,
  nextHole,
}: Props) {
  const router = useRouter();
  const isBetterball = format === "betterball";

  const [pairScores, setPairScores] = useState<PairScores>(() =>
    extractExistingPairScores(existingScore)
  );
  const [bbScores, setBbScores] = useState<BetterballScores>(() =>
    extractExistingBetterball(existingScore)
  );
  const [concededTo, setConcededTo] = useState<"team_a" | "team_b" | null>(
    () => extractConcededTo(existingScore)
  );
  const [confirmConcede, setConfirmConcede] = useState<"team_a" | "team_b" | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  // If an existing score exists but user edits (removes concession), we detect that by inspecting state only.
  useEffect(() => {
    // Reset local state when hole changes via navigation link
    setPairScores(extractExistingPairScores(existingScore));
    setBbScores(extractExistingBetterball(existingScore));
    setConcededTo(extractConcededTo(existingScore));
    setSaveState("idle");
    setError(null);
  }, [holeNumber, existingScore]);

  function parseScore(v: string): number | null {
    const t = v.trim();
    if (t === "") return null;
    const n = parseInt(t, 10);
    if (Number.isNaN(n) || n < 1 || n > 20) return null;
    return n;
  }

  async function save() {
    setSaveState("saving");
    setError(null);

    const body: Record<string, unknown> = {
      device_id:
        typeof window !== "undefined"
          ? (localStorage.getItem("radler_device_id") ??
            (() => {
              const id = `dev-${Math.random().toString(36).slice(2, 10)}`;
              localStorage.setItem("radler_device_id", id);
              return id;
            })())
          : null,
      concede_to: concededTo,
    };

    if (isBetterball) {
      body.team_a_p1_gross = parseScore(bbScores.team_a_p1_gross);
      body.team_a_p2_gross = parseScore(bbScores.team_a_p2_gross);
      body.team_b_p1_gross = parseScore(bbScores.team_b_p1_gross);
      body.team_b_p2_gross = parseScore(bbScores.team_b_p2_gross);
    } else {
      body.team_a_gross = parseScore(pairScores.team_a_gross);
      body.team_b_gross = parseScore(pairScores.team_b_gross);
    }

    // Validation (non-conceded): need both sides to have a gross
    if (!concededTo) {
      if (isBetterball) {
        // Need at least one gross per side
        if (
          body.team_a_p1_gross == null &&
          body.team_a_p2_gross == null
        ) {
          setError("Enter at least one Team A score (or concede).");
          setSaveState("error");
          return;
        }
        if (
          body.team_b_p1_gross == null &&
          body.team_b_p2_gross == null
        ) {
          setError("Enter at least one Team B score (or concede).");
          setSaveState("error");
          return;
        }
      } else {
        if (body.team_a_gross == null || body.team_b_gross == null) {
          setError("Enter both gross scores (or concede).");
          setSaveState("error");
          return;
        }
      }
    }

    try {
      const res = await fetch(`/api/match/${matchId}/hole/${holeNumber}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");

      setSaveState("saved");
      // Navigate back to match or onward to next hole
      router.refresh();
      setTimeout(() => {
        if (nextHole) {
          router.push(`/match/${matchId}/hole/${nextHole}`);
        } else {
          router.push(`/match/${matchId}`);
        }
      }, 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setSaveState("error");
    }
  }

  async function clearHole() {
    if (!existingScore) {
      router.push(`/match/${matchId}`);
      return;
    }
    if (!confirm("Delete this hole's score? The match status will recalculate.")) {
      return;
    }
    setSaveState("saving");
    try {
      const res = await fetch(`/api/match/${matchId}/hole/${holeNumber}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      router.push(`/match/${matchId}`);
      router.refresh();
    } catch {
      setError("Delete failed");
      setSaveState("error");
    }
  }

  const hasExisting = existingScore !== null;

  return (
    <div className="space-y-6">
      {/* Team A */}
      <TeamSection
        team={teamA}
        side="team_a"
        isBetterball={isBetterball}
        pairScores={pairScores}
        setPairScores={setPairScores}
        bbScores={bbScores}
        setBbScores={setBbScores}
        concededTo={concededTo}
        par={par}
      />

      {/* vs separator */}
      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-ink-800" />
        <span className="text-eyebrow uppercase text-ink-500">vs</span>
        <div className="flex-1 h-px bg-ink-800" />
      </div>

      {/* Team B */}
      <TeamSection
        team={teamB}
        side="team_b"
        isBetterball={isBetterball}
        pairScores={pairScores}
        setPairScores={setPairScores}
        bbScores={bbScores}
        setBbScores={setBbScores}
        concededTo={concededTo}
        par={par}
      />

      {/* Concede buttons */}
      {concessionEnabled && (
        <div className="pt-4 border-t border-ink-800">
          <div className="text-eyebrow uppercase text-ink-500 mb-3">
            Concede hole
          </div>
          {concededTo ? (
            <div className="bg-ink-900 border border-ink-700 rounded p-4 flex items-center justify-between">
              <div className="text-sm text-ink-200">
                Hole conceded to{" "}
                <span className="font-medium" style={{ color: concededTo === "team_a" ? teamA.team_colour : teamB.team_colour }}>
                  {concededTo === "team_a" ? teamA.team_name : teamB.team_name}
                </span>
              </div>
              <button
                onClick={() => setConcededTo(null)}
                className="h-9 px-3 rounded border border-ink-700 text-ink-300 hover:text-ink-100 hover:border-ink-500 transition-colors text-xs"
              >
                Undo
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setConfirmConcede("team_b")}
                className="h-11 rounded border text-sm transition-colors"
                style={{
                  borderColor: teamA.team_colour,
                  color: teamA.team_colour,
                }}
              >
                Give hole to {teamA.team_name}
              </button>
              <button
                onClick={() => setConfirmConcede("team_a")}
                className="h-11 rounded border text-sm transition-colors"
                style={{
                  borderColor: teamB.team_colour,
                  color: teamB.team_colour,
                }}
              >
                Give hole to {teamB.team_name}
              </button>
            </div>
          )}
          <p className="text-xs text-ink-500 mt-2 leading-relaxed">
            Scores remain editable after concession — leave blank to record a net double bogey.
          </p>
        </div>
      )}

      {/* Action bar */}
      <div className="sticky bottom-0 pt-4 pb-3 bg-gradient-to-t from-ink-950 via-ink-950 to-transparent -mx-6 md:-mx-10 px-6 md:px-10">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch">
          {error && (
            <div className="text-sm text-tbc mr-auto flex items-center">{error}</div>
          )}
          {saveState === "saved" && (
            <div className="text-sm text-schloss-bright mr-auto flex items-center">
              Saved ✓ {nextHole ? `→ hole ${nextHole}` : "→ match"}
            </div>
          )}

          <div className="flex gap-3 sm:ml-auto">
            {hasExisting && (
              <button
                onClick={clearHole}
                disabled={saveState === "saving"}
                className="h-12 px-4 rounded-md border border-ink-700 text-ink-300 hover:text-tbc hover:border-tbc transition-colors text-sm disabled:opacity-50"
              >
                Clear hole
              </button>
            )}
            <button
              onClick={save}
              disabled={saveState === "saving"}
              className="h-12 px-6 rounded-md bg-schloss text-white hover:bg-schloss-bright transition-colors text-sm font-medium disabled:opacity-50 flex-1 sm:flex-none"
            >
              {saveState === "saving" ? "Saving…" : "Save & next →"}
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation modal for concede */}
      {confirmConcede && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/90"
            onClick={() => setConfirmConcede(null)}
          />
          <div
            className="relative w-full max-w-sm rounded-lg overflow-hidden shadow-2xl border border-ink-700"
            style={{ backgroundColor: "#0F1512" }}
          >
            <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-schloss-bright to-transparent" />
            <div className="p-8">
              <div className="text-eyebrow uppercase text-schloss-bright mb-2">
                Confirm
              </div>
              <h2 className="font-display text-2xl text-ink-100 mb-4">
                Give hole {holeNumber} to{" "}
                {confirmConcede === "team_a" ? teamA.team_name : teamB.team_name}?
              </h2>
              <p className="text-sm text-ink-300 mb-6 leading-relaxed">
                The hole is awarded immediately. You can still enter gross scores below for stats — or leave blank for a net double bogey default.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmConcede(null)}
                  className="flex-1 h-11 rounded-md border border-ink-700 text-ink-200 hover:border-ink-500 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setConcededTo(confirmConcede);
                    setConfirmConcede(null);
                  }}
                  className="flex-1 h-11 rounded-md bg-schloss text-white hover:bg-schloss-bright transition-colors text-sm font-medium"
                >
                  Concede
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TeamSection({
  team,
  side,
  isBetterball,
  pairScores,
  setPairScores,
  bbScores,
  setBbScores,
  concededTo,
  par,
}: {
  team: TeamEntry;
  side: "team_a" | "team_b";
  isBetterball: boolean;
  pairScores: PairScores;
  setPairScores: (p: PairScores) => void;
  bbScores: BetterballScores;
  setBbScores: (b: BetterballScores) => void;
  concededTo: "team_a" | "team_b" | null;
  par: number;
}) {
  const receivingPair = team.pair_strokes_this_hole > 0;
  const isConcededLoser = concededTo !== null && concededTo !== side;

  // Players suggest par as placeholder
  const placeholder = String(par);

  if (isBetterball) {
    return (
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <div className="flex items-baseline gap-2">
            <div
              className="text-eyebrow uppercase"
              style={{ color: team.team_colour }}
            >
              {team.team_display_code} · {team.team_name}
            </div>
          </div>
          {isConcededLoser && (
            <div className="text-xs text-ink-500 italic">Conceded · optional</div>
          )}
        </div>

        <div className="space-y-2">
          {team.players.map((p, idx) => {
            const receiving = p.strokes_this_hole > 0;
            const fieldKey: keyof BetterballScores =
              side === "team_a"
                ? idx === 0
                  ? "team_a_p1_gross"
                  : "team_a_p2_gross"
                : idx === 0
                  ? "team_b_p1_gross"
                  : "team_b_p2_gross";
            return (
              <PlayerRow
                key={p.id}
                name={p.display_name}
                handicap={p.handicap}
                strokes={p.strokes_this_hole}
                receiving={receiving}
                placeholder={placeholder}
                value={bbScores[fieldKey]}
                onChange={(v) => setBbScores({ ...bbScores, [fieldKey]: v })}
                teamColour={team.team_colour}
                teamTint={team.team_tint}
              />
            );
          })}
        </div>
      </div>
    );
  }

  // Pair / singles: one score box
  const isSingles = team.players.length === 1;
  const names = team.players.map((p) => p.display_name).join(" & ");
  const fieldKey: keyof PairScores = side === "team_a" ? "team_a_gross" : "team_b_gross";

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <div
          className="text-eyebrow uppercase"
          style={{ color: team.team_colour }}
        >
          {team.team_display_code} · {team.team_name}
        </div>
        {isConcededLoser && (
          <div className="text-xs text-ink-500 italic">Conceded · optional</div>
        )}
      </div>

      <PlayerRow
        name={names}
        handicap={isSingles ? team.players[0]?.handicap ?? null : null}
        strokes={team.pair_strokes_this_hole}
        receiving={receivingPair}
        placeholder={placeholder}
        value={pairScores[fieldKey]}
        onChange={(v) => setPairScores({ ...pairScores, [fieldKey]: v })}
        teamColour={team.team_colour}
        teamTint={team.team_tint}
      />
    </div>
  );
}

function PlayerRow({
  name,
  handicap,
  strokes,
  receiving,
  placeholder,
  value,
  onChange,
  teamColour,
  teamTint,
}: {
  name: string;
  handicap: number | null;
  strokes: number;
  receiving: boolean;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  teamColour: string;
  teamTint: string;
}) {
  const bgStyle = receiving
    ? {
        backgroundColor: "#3A2A10",
        borderColor: "#BA7517",
      }
    : {
        backgroundColor: teamTint,
        borderColor: teamColour,
      };

  return (
    <div
      className="flex items-center gap-4 p-4 rounded border"
      style={bgStyle}
    >
      <div className="flex-1 min-w-0">
        <div className="text-base text-ink-100 font-medium truncate">
          {name}
        </div>
        <div className="text-xs text-ink-400 flex items-baseline gap-2 mt-0.5">
          {handicap !== null && (
            <span className="font-mono tabular">HCP {handicap}</span>
          )}
          {receiving && (
            <span className="font-mono tabular text-shot-accent">
              +{strokes} stroke{strokes > 1 ? "s" : ""} this hole
            </span>
          )}
        </div>
      </div>

      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={20}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-20 h-14 text-center font-mono tabular text-2xl bg-ink-950 border border-ink-700 rounded text-ink-100 focus:outline-none focus:border-schloss-bright transition-colors"
      />
    </div>
  );
}

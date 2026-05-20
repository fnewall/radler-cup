"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

type RosterPlayer = {
  id: string;
  display_name: string;
  handicap: number | null;
  available: boolean;
};

type ExistingPairing = {
  id: string;
  match_order: number;
  submitted_at: string | null;
  players: Array<{ player_id: string; slot: number }>;
};

type Props = {
  sessionId: string;
  format: string;
  matchCount: number;
  roster: RosterPlayer[];
  existing: ExistingPairing[];
  alreadySubmitted: boolean;
  pairingsRevealed: boolean;
  otherSubmitted: boolean;
  teamColour: string;
};

type Slot = {
  match_order: number;
  player_ids: string[];
};

const FORMAT_LABELS: Record<string, string> = {
  foursomes: "Foursomes",
  betterball: "Betterball",
  greensomes: "Greensomes",
  scramble_2v2: "Scramble",
  singles: "Singles",
};

// Maximum players a slot can hold (1 for singles, 2 for pair formats).
// A slot is allowed to have FEWER (solo in a pair format).
function maxSlotSize(format: string): 1 | 2 {
  return format === "singles" ? 1 : 2;
}

function buildInitialSlots(
  matchCount: number,
  existing: ExistingPairing[]
): Slot[] {
  const byOrder = new Map<number, Slot>();
  for (const p of existing) {
    byOrder.set(p.match_order, {
      match_order: p.match_order,
      player_ids: [...p.players]
        .sort((a, b) => a.slot - b.slot)
        .map((pp) => pp.player_id),
    });
  }
  const out: Slot[] = [];
  for (let i = 1; i <= matchCount; i++) {
    out.push(byOrder.get(i) ?? { match_order: i, player_ids: [] });
  }
  return out;
}

export function PairingsDrafter({
  sessionId,
  format,
  matchCount,
  roster,
  existing,
  alreadySubmitted,
  pairingsRevealed,
  otherSubmitted,
  teamColour,
}: Props) {
  const router = useRouter();
  const maxSize = maxSlotSize(format);
  const isPairFormat = maxSize === 2;

  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [slots, setSlots] = useState<Slot[]>(() =>
    buildInitialSlots(matchCount, existing)
  );
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  const usedPlayerIds = useMemo(() => {
    const s = new Set<string>();
    for (const slot of slots) {
      for (const pid of slot.player_ids) s.add(pid);
    }
    return s;
  }, [slots]);

  const availableRoster = useMemo(
    () => roster.filter((p) => p.available),
    [roster]
  );

  const readOnly = alreadySubmitted || pairingsRevealed;

  // Count filled slots and solo slots (helpful summary)
  const filledSlots = slots.filter((s) => s.player_ids.length > 0);
  const filledCount = filledSlots.length;
  const soloCount = isPairFormat
    ? filledSlots.filter((s) => s.player_ids.length === 1).length
    : 0;

  function clickPlayer(playerId: string) {
    if (readOnly) return;
    setSelectedPlayer((prev) => (prev === playerId ? null : playerId));
  }

  function clickSlotAddHere(matchOrder: number) {
    if (readOnly || !selectedPlayer) return;
    setSlots((prev) =>
      prev.map((s) => {
        if (s.match_order !== matchOrder) return s;
        if (s.player_ids.length >= maxSize) return s;
        if (s.player_ids.includes(selectedPlayer)) return s;
        return { ...s, player_ids: [...s.player_ids, selectedPlayer] };
      })
    );
    setSelectedPlayer(null);
  }

  function removeFromSlot(matchOrder: number, playerId: string) {
    if (readOnly) return;
    setSlots((prev) =>
      prev.map((s) =>
        s.match_order !== matchOrder
          ? s
          : { ...s, player_ids: s.player_ids.filter((id) => id !== playerId) }
      )
    );
  }

  function playerById(id: string): RosterPlayer | undefined {
    return roster.find((p) => p.id === id);
  }

  async function save(submit: boolean) {
    setSaveState("saving");
    setError(null);

    if (submit) {
      if (filledCount < 1) {
        setError("Add at least one pairing before submitting.");
        setSaveState("error");
        setConfirmSubmit(false);
        return;
      }
    }

    try {
      const res = await fetch("/api/captain/pairings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          slots: slots.filter((s) => s.player_ids.length > 0),
          submit,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");

      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1500);

      if (submit) {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setSaveState("error");
    } finally {
      setConfirmSubmit(false);
    }
  }

  return (
    <div className="space-y-8">
      {readOnly && (
        <div className="bg-ink-950 border border-schloss rounded-sm p-5">
          <div className="text-eyebrow uppercase text-schloss-bright mb-1">
            Submitted
          </div>
          <p className="text-sm text-ink-200 leading-relaxed">
            {pairingsRevealed
              ? "Pairings have been revealed to all players."
              : otherSubmitted
                ? "Both captains have submitted. Finalising matches…"
                : "Waiting for the other captain to submit. Pairings will reveal to everyone once they do."}
          </p>
        </div>
      )}

      {!readOnly && isPairFormat && (
        <div className="bg-ink-950 border border-ink-800 rounded-sm p-4 text-sm text-ink-300 leading-relaxed">
          <div className="text-eyebrow uppercase text-shot-accent mb-1.5">
            Dropouts &amp; solos
          </div>
          You can submit fewer than {matchCount} pairings if players have
          dropped out, and you can leave a slot with one player (a solo).
          The final match count will be the smaller of what each captain
          submits.
        </div>
      )}

      <section>
        <div className="flex items-baseline justify-between mb-4">
          <div className="text-eyebrow uppercase text-schloss-bright">
            Your roster · tap to select, then tap a slot
          </div>
          <div className="text-xs text-ink-500 font-mono tabular">
            {availableRoster.length - usedPlayerIds.size} /{" "}
            {availableRoster.length} unassigned
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {roster.map((p) => {
            const used = usedPlayerIds.has(p.id);
            const unavailable = !p.available;
            const selected = selectedPlayer === p.id;
            return (
              <button
                key={p.id}
                onClick={() => clickPlayer(p.id)}
                disabled={readOnly || used || unavailable}
                className={`px-3 h-10 rounded-full border text-sm transition-colors inline-flex items-center gap-2
                  ${
                    selected
                      ? "bg-schloss-bright text-ink-950 border-schloss-bright"
                      : used
                        ? "bg-ink-900 text-ink-600 border-ink-800 line-through cursor-not-allowed"
                        : unavailable
                          ? "bg-ink-950 text-tbc border-tbc/40 line-through cursor-not-allowed"
                          : "bg-ink-900 text-ink-100 border-ink-700 hover:border-schloss-bright"
                  }`}
              >
                <span>{p.display_name}</span>
                {p.handicap !== null && (
                  <span className="font-mono tabular text-xs text-ink-400">
                    {p.handicap}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-4">
          <div className="text-eyebrow uppercase text-schloss-bright">
            Match order · {FORMAT_LABELS[format] ?? format}
          </div>
          <div className="text-xs text-ink-500">
            {filledCount} of up to {matchCount} filled
            {soloCount > 0 && ` · ${soloCount} solo`}
          </div>
        </div>

        <div className="space-y-2">
          {slots.map((slot) => (
            <SlotRow
              key={slot.match_order}
              slot={slot}
              maxSize={maxSize}
              isPairFormat={isPairFormat}
              playerById={playerById}
              onAddHere={() => clickSlotAddHere(slot.match_order)}
              onRemove={(pid) => removeFromSlot(slot.match_order, pid)}
              canAdd={!readOnly && selectedPlayer !== null}
              readOnly={readOnly}
              teamColour={teamColour}
            />
          ))}
        </div>
      </section>

      {!readOnly && (
        <div className="sticky bottom-0 pt-6 pb-4 bg-gradient-to-t from-ink-950 via-ink-950 to-transparent -mx-6 md:-mx-10 px-6 md:px-10">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-end">
            {error && <div className="text-sm text-tbc mr-auto">{error}</div>}
            {saveState === "saved" && (
              <div className="text-sm text-schloss-bright mr-auto">Saved ✓</div>
            )}
            <button
              onClick={() => save(false)}
              disabled={saveState === "saving"}
              className="h-11 px-5 rounded-md border border-ink-700 text-ink-200 hover:border-ink-500 hover:text-ink-100 transition-colors text-sm disabled:opacity-50"
            >
              {saveState === "saving" ? "Saving…" : "Save draft"}
            </button>
            <button
              onClick={() => setConfirmSubmit(true)}
              disabled={saveState === "saving" || filledCount < 1}
              className="h-11 px-5 rounded-md bg-schloss text-white hover:bg-schloss-bright transition-colors text-sm font-medium disabled:opacity-50"
            >
              Submit {filledCount} {filledCount === 1 ? "pair" : "pairs"} (locks)
            </button>
          </div>
        </div>
      )}

      {confirmSubmit && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/90"
            onClick={() => setConfirmSubmit(false)}
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
                Submit {filledCount} {filledCount === 1 ? "pairing" : "pairings"}?
              </h2>
              <p className="text-sm text-ink-300 mb-3 leading-relaxed">
                Once submitted, your pairings lock. They reveal to everyone
                when the other captain also submits. You cannot edit afterwards
                without contacting the admin.
              </p>
              {filledCount < matchCount && (
                <p className="text-sm text-shot-accent mb-3 leading-relaxed">
                  You&apos;re submitting {filledCount} of a possible {matchCount}.
                  Final match count will be min(your {filledCount}, other captain&apos;s).
                </p>
              )}
              {soloCount > 0 && (
                <p className="text-sm text-shot-accent mb-3 leading-relaxed">
                  {soloCount} solo {soloCount === 1 ? "player" : "players"} —
                  worth a full point each if both teams field a player.
                </p>
              )}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setConfirmSubmit(false)}
                  className="flex-1 h-11 rounded-md border border-ink-700 text-ink-200 hover:border-ink-500 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => save(true)}
                  className="flex-1 h-11 rounded-md bg-schloss text-white hover:bg-schloss-bright transition-colors text-sm font-medium"
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SlotRow({
  slot,
  maxSize,
  isPairFormat,
  playerById,
  onAddHere,
  onRemove,
  canAdd,
  readOnly,
  teamColour,
}: {
  slot: Slot;
  maxSize: 1 | 2;
  isPairFormat: boolean;
  playerById: (id: string) => RosterPlayer | undefined;
  onAddHere: () => void;
  onRemove: (pid: string) => void;
  canAdd: boolean;
  readOnly: boolean;
  teamColour: string;
}) {
  const full = slot.player_ids.length >= maxSize;
  const empty = slot.player_ids.length === 0;
  const solo = isPairFormat && slot.player_ids.length === 1;

  return (
    <div
      className={`bg-ink-950 border rounded-sm ${
        solo ? "border-shot-accent/40" : "border-ink-800"
      }`}
    >
      <div className="flex items-stretch">
        <div
          className="flex items-center justify-center px-5 py-4 min-w-[60px] border-r border-ink-800"
          style={{ color: teamColour }}
        >
          <div className="font-mono tabular text-xl font-light">
            {String(slot.match_order).padStart(2, "0")}
          </div>
        </div>

        <div className="flex-1 px-4 py-3 flex flex-wrap gap-2 items-center min-h-[60px]">
          {slot.player_ids.map((pid, idx) => {
            const p = playerById(pid);
            return (
              <span
                key={pid}
                className="inline-flex items-center gap-2 h-8 px-3 rounded-full bg-ink-800 border border-ink-700 text-sm"
              >
                <span className="text-ink-100">{p?.display_name ?? "?"}</span>
                {p?.handicap !== null && p?.handicap !== undefined && (
                  <span className="font-mono tabular text-xs text-ink-400">
                    {p.handicap}
                  </span>
                )}
                {!readOnly && (
                  <button
                    onClick={() => onRemove(pid)}
                    className="text-ink-500 hover:text-tbc ml-1"
                    aria-label={`Remove ${p?.display_name}`}
                  >
                    ×
                  </button>
                )}
                {idx < slot.player_ids.length - 1 && maxSize > 1 && (
                  <span className="text-ink-600 ml-1">&amp;</span>
                )}
              </span>
            );
          })}

          {empty && (
            <span className="text-xs text-ink-500 italic">Empty slot</span>
          )}
          {solo && (
            <span className="text-[10px] uppercase tracking-[0.15em] text-shot-accent font-medium ml-1">
              solo
            </span>
          )}
        </div>

        {!readOnly && !full && (
          <button
            onClick={onAddHere}
            disabled={!canAdd}
            className="px-4 border-l border-ink-800 text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-ink-300 hover:text-schloss-bright hover:bg-ink-900"
            aria-label={`Add selected player to match ${slot.match_order}`}
          >
            +
          </button>
        )}
      </div>
    </div>
  );
}

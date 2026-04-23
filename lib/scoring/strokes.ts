export type Hole = {
  hole_number: number;
  par: number;
  stroke_index: number;
};

// Given a player's integer-rounded stroke count and the course's 18 stroke
// indices, return a map of hole_number -> strokes received on that hole.
// Stacks beyond 18 handicap (so at 19 strokes, you get 2 on SI 1).
export function strokesPerHole(
  totalStrokes: number,
  holes: Hole[],
  maxPerHole: number | null
): Record<number, number> {
  const result: Record<number, number> = {};
  for (const h of holes) result[h.hole_number] = 0;

  if (totalStrokes <= 0) return result;

  // Round (at the hole level, strokes are integers). Standard practice.
  const whole = Math.round(totalStrokes);
  if (whole <= 0) return result;

  // One pass per full 18 strokes.
  let remaining = whole;
  let pass = 0;
  while (remaining > 0 && pass < 4) {
    // Assign 1 stroke to holes with SI 1..remaining-in-pass
    const thisPass = Math.min(18, remaining);
    for (const h of holes) {
      if (h.stroke_index <= thisPass) {
        result[h.hole_number] = (result[h.hole_number] ?? 0) + 1;
      }
    }
    remaining -= thisPass;
    pass += 1;
  }

  // Apply per-hole cap if configured
  if (maxPerHole !== null && maxPerHole !== undefined) {
    for (const hn of Object.keys(result)) {
      const n = Number(hn);
      if (result[n] > maxPerHole) result[n] = maxPerHole;
    }
  }

  return result;
}

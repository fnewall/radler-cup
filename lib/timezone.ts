// The tournament is played in Europe/Vienna. All scheduled times are entered
// and displayed as Vienna local time. Postgres stores them as timestamptz (UTC).

const TZ = "Europe/Vienna";

/** Returns the offset in minutes that Vienna is ahead of UTC at the given instant. */
function getOffsetMinutes(instant: Date): number {
  const utcParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(instant);

  const viennaParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(instant);

  const toMs = (parts: Intl.DateTimeFormatPart[]) => {
    const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
    return Date.UTC(
      Number(g("year")),
      Number(g("month")) - 1,
      Number(g("day")),
      Number(g("hour")),
      Number(g("minute")),
      Number(g("second"))
    );
  };

  return (toMs(viennaParts) - toMs(utcParts)) / 60000;
}

/**
 * Convert a naive local datetime string (e.g. "2026-07-04T09:00") —
 * assumed to be Vienna local time — into a UTC ISO string for storage.
 */
export function viennaLocalToIso(localStr: string): string {
  if (!localStr) return "";
  // Interpret as if UTC, then compensate for Vienna's offset at that instant.
  const asUTC = new Date(localStr + "Z");
  if (Number.isNaN(asUTC.getTime())) return "";
  const offsetMin = getOffsetMinutes(asUTC);
  const real = new Date(asUTC.getTime() - offsetMin * 60000);
  return real.toISOString();
}

/**
 * Convert a stored UTC ISO string back to a naive Vienna local datetime
 * suitable for a `<input type="datetime-local">` value.
 */
export function isoToViennaLocal(isoStr: string | null | undefined): string {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}

/** Nicely formatted display: "Sat 4 Jul · 09:00" in Vienna time. */
export function formatViennaDisplay(isoStr: string | null | undefined): string {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

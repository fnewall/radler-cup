import Link from "next/link";
import { GearButton } from "./GearButton";

/**
 * Sticky green top bar used on every app screen.
 * - On mobile: full-bleed, safe-area aware
 * - On desktop: contained to the page max-width
 *
 * Provide an `eyebrow` (small caps text on the left) and optionally a `back`
 * destination — when present, a chevron-back replaces the live dot.
 */
export function AppHeader({
  eyebrow,
  back,
}: {
  eyebrow: string;
  back?: { href: string; label?: string };
}) {
  return (
    <header className="sticky top-0 z-30 bg-schloss-band">
      <div className="max-w-6xl mx-auto px-4 md:px-8 pt-safe pb-3 flex items-center justify-between gap-3 min-h-[52px]">
        <div className="flex items-center gap-2 min-w-0">
          {back ? (
            <Link
              href={back.href}
              className="-ml-1 inline-flex items-center gap-1.5 text-white/90 hover:text-white"
              aria-label={back.label ?? "Back"}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M15 6l-6 6 6 6"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-eyebrow uppercase truncate">{eyebrow}</span>
            </Link>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-schloss-glow animate-pulse-live shrink-0" />
              <span className="text-eyebrow uppercase text-white/85 truncate">
                {eyebrow}
              </span>
            </>
          )}
        </div>
        <GearButton />
      </div>
    </header>
  );
}

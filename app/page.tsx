import { Countdown } from "@/components/Countdown";
import { TeamCrest } from "@/components/TeamCrest";

// Target: tournament start date. Placeholder for now — editable via admin later.
const TOURNAMENT_START = "2026-09-04T09:00:00+02:00";

export default function Home() {
  return (
    <main className="min-h-screen bg-radial-schloss texture-noise relative overflow-hidden">
      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-6 md:px-10 py-6">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-schloss-bright animate-pulse-live" />
          <span className="text-eyebrow uppercase text-ink-300">
            Radler Cup · MMXXVI
          </span>
        </div>
        <button
          aria-label="Settings"
          className="w-9 h-9 rounded-full border border-ink-700 hover:border-ink-500 transition-colors flex items-center justify-center text-ink-300 hover:text-ink-100"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </header>

      {/* Hero */}
      <section className="relative z-10 px-6 md:px-10 pt-12 md:pt-24 pb-20 max-w-7xl mx-auto">
        <div className="text-center">
          <div className="text-eyebrow uppercase text-schloss-bright mb-6">
            4 — 6 September · Schloss Ernegg, Austria
          </div>
          <h1 className="font-display text-hero text-ink-100 leading-[0.9]">
            The Radler Cup
          </h1>
          <p className="mt-6 text-lg text-ink-300 max-w-xl mx-auto leading-relaxed">
            Twenty-four players. Two teams. Three days of match play at Golf Club Schloss Ernegg.
          </p>
        </div>

        {/* Countdown */}
        <div className="mt-16 md:mt-24 flex justify-center">
          <Countdown target={TOURNAMENT_START} />
        </div>
      </section>

      {/* Hairline */}
      <div className="relative z-10 hairline max-w-5xl mx-auto" />

      {/* Teams face-off */}
      <section className="relative z-10 px-6 md:px-10 py-20 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <div className="text-eyebrow uppercase text-ink-500 mb-3">The Tie</div>
          <h2 className="font-display text-display text-ink-100">Team versus Team</h2>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] gap-6 md:gap-16 items-center">
          <TeamCrest
            team="sandbaggers"
            name="Sandbaggers"
            captain="Newall"
            players={12}
            handicapTotal={155}
            align="right"
          />

          <div className="flex flex-col items-center gap-3">
            <div className="font-display text-3xl md:text-5xl font-light text-ink-500 italic">
              vs
            </div>
            <div className="hairline-v h-16" />
            <div className="text-eyebrow uppercase text-ink-500">
              36 pts
            </div>
          </div>

          <TeamCrest
            team="tbc"
            name="TBC"
            captain="Lloyd"
            players={12}
            handicapTotal={155}
            align="left"
          />
        </div>
      </section>

      {/* Hairline */}
      <div className="relative z-10 hairline max-w-5xl mx-auto" />

      {/* Format */}
      <section className="relative z-10 px-6 md:px-10 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <div className="text-eyebrow uppercase text-ink-500 mb-3">The Format</div>
          <h2 className="font-display text-display text-ink-100">Five Sessions · Thirty-six Points</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-px bg-ink-800 border border-ink-800 rounded-sm overflow-hidden">
          {[
            { day: "Day 1", time: "Morning", format: "Foursomes", pts: 6 },
            { day: "Day 1", time: "Afternoon", format: "Betterball", pts: 6 },
            { day: "Day 2", time: "Morning", format: "Greensomes", pts: 6 },
            { day: "Day 2", time: "Afternoon", format: "Scramble", pts: 6 },
            { day: "Day 3", time: "Singles", format: "12 Matches", pts: 12 },
          ].map((s, i) => (
            <div key={i} className="bg-ink-950 p-6 hover:bg-ink-900 transition-colors">
              <div className="text-eyebrow uppercase text-schloss-bright mb-4">
                Session {i + 1}
              </div>
              <div className="text-ink-400 text-sm">{s.day}</div>
              <div className="text-ink-300 text-sm mb-6">{s.time}</div>
              <div className="font-display text-2xl text-ink-100 leading-tight">
                {s.format}
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-mono tabular text-2xl text-ink-100">{s.pts}</span>
                <span className="text-eyebrow uppercase text-ink-500">pts</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 text-center">
          <div>
            <div className="font-mono tabular text-4xl font-light text-ink-100">18.5</div>
            <div className="text-eyebrow uppercase text-ink-500 mt-2">To Win</div>
          </div>
          <div className="hairline-v h-12 hidden md:block" />
          <div>
            <div className="font-mono tabular text-4xl font-light text-ink-100">18—18</div>
            <div className="text-eyebrow uppercase text-ink-500 mt-2">Tie</div>
          </div>
          <div className="hairline-v h-12 hidden md:block" />
          <div>
            <div className="font-mono tabular text-4xl font-light text-ink-100">72</div>
            <div className="text-eyebrow uppercase text-ink-500 mt-2">Par</div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-6 md:px-10 py-10 max-w-7xl mx-auto">
        <div className="hairline mb-8" />
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-ink-500">
          <div className="text-eyebrow uppercase">
            Golf Club Schloss Ernegg · Niederösterreich
          </div>
          <div className="text-eyebrow uppercase">
            Live scoring · updates every second
          </div>
        </div>
      </footer>
    </main>
  );
}

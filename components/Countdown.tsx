"use client";

import { useEffect, useState } from "react";

interface CountdownProps {
  target: string; // ISO datetime
}

function diff(target: Date) {
  const ms = target.getTime() - Date.now();
  if (ms <= 0) return null;
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return { days, hours, minutes, seconds };
}

// Render nothing on server — compute the time only after mount.
// Prevents hydration mismatch from server/client clock drift.
export function Countdown({ target }: CountdownProps) {
  const [time, setTime] = useState<ReturnType<typeof diff>>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const targetDate = new Date(target);
    setTime(diff(targetDate));
    setMounted(true);
    const id = setInterval(() => setTime(diff(targetDate)), 1000);
    return () => clearInterval(id);
  }, [target]);

  // Placeholder with reserved space — same height whether loading or live
  if (!mounted) {
    return (
      <div className="flex items-start gap-6 md:gap-10 opacity-0" aria-hidden>
        <div className="tabular font-mono text-4xl md:text-6xl font-light leading-none">
          00
        </div>
      </div>
    );
  }

  if (!time) {
    return (
      <div className="text-eyebrow text-schloss-bright uppercase">
        Tournament live
      </div>
    );
  }

  const units = [
    { label: "Days", value: time.days },
    { label: "Hours", value: time.hours },
    { label: "Minutes", value: time.minutes },
    { label: "Seconds", value: time.seconds },
  ];

  return (
    <div className="flex items-start gap-6 md:gap-10">
      {units.map((u, i) => (
        <div key={u.label} className="relative flex flex-col items-center">
          <div className="tabular font-mono text-4xl md:text-6xl font-light text-ink-100 leading-none">
            {u.value.toString().padStart(2, "0")}
          </div>
          <div className="mt-3 text-eyebrow text-ink-400 uppercase">
            {u.label}
          </div>
          {i < units.length - 1 && (
            <div className="absolute -right-3 md:-right-5 top-1 text-4xl md:text-6xl font-light text-ink-700">
              :
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

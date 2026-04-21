import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type Tile = {
  label: string;
  desc: string;
  count: string;
  href?: string;
};

const TILES: Tile[] = [
  { label: "Players", desc: "Names · handicaps · teams", count: "24", href: "/admin/players" },
  { label: "Teams", desc: "Names · colours · captains", count: "2", href: "/admin/teams" },
  { label: "Course", desc: "Par · stroke index · yardages", count: "18" },
  { label: "Sessions", desc: "Dates · times · allowances", count: "5", href: "/admin/sessions" },
  { label: "Rules", desc: "Cap · match end · tiebreaker", count: "—", href: "/admin/rules" },
  { label: "Passwords", desc: "Player · captain · admin", count: "4", href: "/admin/passwords" },
];

export default async function AdminPage() {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  if (session.role !== "admin") {
    return (
      <main className="min-h-screen bg-radial-schloss flex items-center justify-center p-8">
        <div className="text-center space-y-4 max-w-sm">
          <div className="text-eyebrow uppercase text-tbc">Restricted</div>
          <h1 className="font-display text-3xl text-ink-100">Admin only</h1>
          <p className="text-sm text-ink-400">
            You&apos;re signed in as{" "}
            <span className="text-ink-200">{session.role}</span>, but this area
            requires the admin password.
          </p>
          <Link
            href="/"
            className="inline-block mt-4 text-sm text-schloss-bright hover:text-ink-100 transition-colors"
          >
            ← Back to home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-radial-schloss texture-noise">
      <header className="flex items-center justify-between px-6 md:px-10 py-6">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-schloss-bright animate-pulse-live" />
          <span className="text-eyebrow uppercase text-ink-300">
            Radler Cup · Admin
          </span>
        </div>
        <Link
          href="/"
          className="text-eyebrow uppercase text-ink-400 hover:text-ink-100 transition-colors"
        >
          ← Home
        </Link>
      </header>

      <section className="px-6 md:px-10 pt-12 pb-20 max-w-6xl mx-auto">
        <div className="text-eyebrow uppercase text-schloss-bright mb-4">
          Control Room
        </div>
        <h1 className="font-display text-hero text-ink-100 leading-[0.9] mb-4">
          Admin
        </h1>
        <p className="text-ink-300 text-lg max-w-xl">
          Edit everything: players, teams, course, sessions, scoring rules, tiebreaker, passwords.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-ink-800 border border-ink-800 rounded-sm overflow-hidden mt-16">
          {TILES.map((tile) => {
            const content = (
              <>
                <div className="flex items-start justify-between mb-4">
                  <div className="text-eyebrow uppercase text-schloss-bright">
                    {tile.label}
                  </div>
                  <div className="font-mono tabular text-xs text-ink-500">
                    {tile.count}
                  </div>
                </div>
                <div className="text-ink-300 text-sm">{tile.desc}</div>
                <div
                  className={`mt-6 text-eyebrow uppercase ${
                    tile.href ? "text-schloss-bright" : "text-ink-600"
                  }`}
                >
                  {tile.href ? "Edit →" : "Coming soon"}
                </div>
              </>
            );

            return tile.href ? (
              <Link
                key={tile.label}
                href={tile.href}
                className="bg-ink-950 p-8 hover:bg-ink-900 transition-colors block"
              >
                {content}
              </Link>
            ) : (
              <div
                key={tile.label}
                className="bg-ink-950 p-8 opacity-60 cursor-not-allowed"
              >
                {content}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { TeamsEditor } from "@/components/admin/TeamsEditor";

export const dynamic = "force-dynamic";

export default async function TeamsAdminPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/");

  const supabase = createAdminClient();

  const { data: tournament } = await supabase
    .from("tournament")
    .select("id")
    .limit(1)
    .single();

  if (!tournament) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-ink-400">No tournament found.</div>
      </main>
    );
  }

  const [{ data: teams }, { data: players }] = await Promise.all([
    supabase
      .from("team")
      .select("id, name, display_code, colour_primary, colour_dark_text, colour_bg_tint, colour_border, captain_player_id")
      .eq("tournament_id", tournament.id)
      .order("name"),
    supabase
      .from("player")
      .select("id, display_name, team_id")
      .eq("tournament_id", tournament.id),
  ]);

  // Keep Sandbaggers first if present
  const sortedTeams = (teams ?? []).sort((a, b) =>
    a.name === "Sandbaggers" ? -1 : b.name === "Sandbaggers" ? 1 : 0
  );

  return (
    <main className="min-h-screen bg-radial-schloss texture-noise">
      <header className="flex items-center justify-between px-6 md:px-10 py-6">
        <Link
          href="/admin"
          className="text-eyebrow uppercase text-ink-400 hover:text-ink-100 transition-colors"
        >
          ← Admin
        </Link>
        <div className="text-eyebrow uppercase text-ink-500">
          Radler Cup · Teams
        </div>
      </header>

      <section className="px-6 md:px-10 pt-8 pb-20 max-w-4xl mx-auto">
        <div className="mb-12">
          <div className="text-eyebrow uppercase text-schloss-bright mb-3">
            Team Setup
          </div>
          <h1 className="font-display text-hero text-ink-100 leading-[0.9] mb-4">
            Teams
          </h1>
          <p className="text-ink-300 text-base max-w-2xl leading-relaxed">
            Rename teams, change the captain, tweak colours. Preview shows how
            the colour set looks together.
          </p>
        </div>

        <TeamsEditor
          initialTeams={sortedTeams}
          players={players ?? []}
        />
      </section>
    </main>
  );
}

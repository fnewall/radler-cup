import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { PlayersEditor } from "@/components/admin/PlayersEditor";

export const dynamic = "force-dynamic";

export default async function PlayersAdminPage() {
  const session = await getSession();
  if (!session) redirect("/");
  if (session.role !== "admin") redirect("/");

  const supabase = createAdminClient();

  const { data: tournament } = await supabase
    .from("tournament")
    .select("id, name")
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
      .select("id, name")
      .eq("tournament_id", tournament.id),
    supabase
      .from("player")
      .select("id, display_name, handicap, team_id, roster_order")
      .eq("tournament_id", tournament.id),
  ]);

  return (
    <main className="min-h-screen bg-radial-schloss texture-noise">
      <header className="flex items-center justify-between px-6 md:px-10 py-6">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="text-eyebrow uppercase text-ink-400 hover:text-ink-100 transition-colors"
          >
            ← Admin
          </Link>
        </div>
        <div className="text-eyebrow uppercase text-ink-500">
          Radler Cup · Players
        </div>
      </header>

      <section className="px-6 md:px-10 pt-8 pb-20 max-w-6xl mx-auto">
        <div className="mb-12">
          <div className="text-eyebrow uppercase text-schloss-bright mb-3">
            Roster · {players?.length ?? 0} Players
          </div>
          <h1 className="font-display text-hero text-ink-100 leading-[0.9] mb-4">
            Players
          </h1>
          <p className="text-ink-300 text-base max-w-2xl leading-relaxed">
            Edit display names and handicaps. Tap the arrow icon to move a player to the other team. Changes save automatically.
          </p>
        </div>

        <PlayersEditor
          initialPlayers={players ?? []}
          teams={teams ?? []}
        />
      </section>
    </main>
  );
}

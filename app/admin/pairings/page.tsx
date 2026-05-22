import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminPairingsList } from "@/components/admin/AdminPairingsList";

export const dynamic = "force-dynamic";

const FORMAT_LABELS: Record<string, string> = {
  foursomes: "Foursomes",
  betterball: "Betterball",
  greensomes: "Greensomes",
  scramble_2v2: "Scramble",
  singles: "Singles",
};

export default async function AdminPairingsPage() {
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

  const { data: teams } = await supabase
    .from("team")
    .select("id, name, display_code, colour_primary, display_order")
    .eq("tournament_id", tournament.id)
    .order("display_order", { ascending: true, nullsFirst: false });

  const { data: sessions } = await supabase
    .from("session")
    .select(
      "id, session_number, label, format, match_count, pairings_revealed, status, start_at"
    )
    .eq("tournament_id", tournament.id)
    .order("session_number", { ascending: true });

  const { data: pairings } = await supabase
    .from("pairing")
    .select(
      "id, session_id, team_id, match_order, submitted_at"
    )
    .in("session_id", (sessions ?? []).map((s) => s.id));

  const pairingIds = (pairings ?? []).map((p) => p.id);
  const { data: pairingPlayers } = pairingIds.length
    ? await supabase
        .from("pairing_player")
        .select("pairing_id, player_id, slot")
        .in("pairing_id", pairingIds)
    : { data: [] };

  const { data: players } = await supabase
    .from("player")
    .select("id, display_name, handicap, team_id")
    .eq("tournament_id", tournament.id)
    .order("display_name", { ascending: true });

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
          Pairings override
        </div>
      </header>

      <section className="px-6 md:px-10 pt-8 pb-20 max-w-5xl mx-auto">
        <div className="mb-10">
          <div className="text-eyebrow uppercase text-schloss-bright mb-3">
            Override &amp; Unlock
          </div>
          <h1 className="font-display text-hero text-ink-100 leading-[0.9] mb-4">
            Pairings
          </h1>
          <p className="text-ink-300 text-base max-w-2xl leading-relaxed">
            Edit either team&apos;s pairings at any time. Unlock a captain so they can resubmit before reveal. Force-reveal a session when both teams are ready.
          </p>
        </div>

        <AdminPairingsList
          teams={teams ?? []}
          sessions={(sessions ?? []).map((s) => ({
            ...s,
            format_label: FORMAT_LABELS[s.format] ?? s.format,
          }))}
          pairings={pairings ?? []}
          pairingPlayers={pairingPlayers ?? []}
          players={players ?? []}
        />
      </section>
    </main>
  );
}

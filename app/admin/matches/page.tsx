import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminMatchesList } from "@/components/admin/AdminMatchesList";

export const dynamic = "force-dynamic";

const FORMAT_LABELS: Record<string, string> = {
  foursomes: "Foursomes",
  betterball: "Betterball",
  greensomes: "Greensomes",
  scramble_2v2: "Scramble",
  singles: "Singles",
};

export default async function AdminMatchesPage() {
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
      "id, session_number, label, format, match_count, points_per_match"
    )
    .eq("tournament_id", tournament.id)
    .order("session_number", { ascending: true });

  const sessionIds = (sessions ?? []).map((s) => s.id);

  const { data: matches } = sessionIds.length
    ? await supabase
        .from("match")
        .select(
          "id, session_id, match_order, status, winning_team_id, points_team_a, points_team_b, ended_on_hole, team_a_pairing_id, team_b_pairing_id"
        )
        .in("session_id", sessionIds)
        .order("match_order", { ascending: true })
    : { data: [] };

  const pairingIds = [
    ...new Set(
      (matches ?? []).flatMap((m) => [
        m.team_a_pairing_id,
        m.team_b_pairing_id,
      ])
    ),
  ];

  const { data: pairingPlayers } = pairingIds.length
    ? await supabase
        .from("pairing_player")
        .select("pairing_id, player_id, slot")
        .in("pairing_id", pairingIds)
    : { data: [] };

  const { data: players } = await supabase
    .from("player")
    .select("id, display_name, team_id")
    .eq("tournament_id", tournament.id);

  // Count hole_scores per match
  const matchIds = (matches ?? []).map((m) => m.id);
  const { data: scoreCounts } = matchIds.length
    ? await supabase
        .from("hole_score")
        .select("match_id")
        .in("match_id", matchIds)
    : { data: [] };

  const scoreCountByMatch = new Map<string, number>();
  for (const r of scoreCounts ?? []) {
    scoreCountByMatch.set(
      r.match_id,
      (scoreCountByMatch.get(r.match_id) ?? 0) + 1
    );
  }

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
          Match override
        </div>
      </header>

      <section className="px-6 md:px-10 pt-8 pb-20 max-w-5xl mx-auto">
        <div className="mb-10">
          <div className="text-eyebrow uppercase text-schloss-bright mb-3">
            Reset · Concede · Force result
          </div>
          <h1 className="font-display text-hero text-ink-100 leading-[0.9] mb-4">
            Matches
          </h1>
          <p className="text-ink-300 text-base max-w-2xl leading-relaxed">
            Reset a match if scores were entered in error. Concede a match to a team. Override the final points. Edits push live to all devices.
          </p>
        </div>

        <AdminMatchesList
          teams={teams ?? []}
          sessions={(sessions ?? []).map((s) => ({
            ...s,
            format_label: FORMAT_LABELS[s.format] ?? s.format,
          }))}
          matches={(matches ?? []).map((m) => ({
            ...m,
            scores_entered: scoreCountByMatch.get(m.id) ?? 0,
          }))}
          pairingPlayers={pairingPlayers ?? []}
          players={players ?? []}
        />
      </section>
    </main>
  );
}

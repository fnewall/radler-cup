import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { SessionsEditor } from "@/components/admin/SessionsEditor";

export const dynamic = "force-dynamic";

export default async function SessionsAdminPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/");

  const supabase = createAdminClient();

  const { data: tournament } = await supabase
    .from("tournament")
    .select("id, name, start_date, end_date, points_to_win, points_to_tie, tiebreaker_rule")
    .limit(1)
    .single();

  if (!tournament) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-ink-400">No tournament found.</div>
      </main>
    );
  }

  const [{ data: sessions }, { data: course }] = await Promise.all([
    supabase
      .from("session")
      .select("id, session_number, label, day_number, start_at, format, match_count, points_per_match, tees_used, handicap_allowance")
      .eq("tournament_id", tournament.id)
      .order("session_number", { ascending: true }),
    supabase
      .from("course")
      .select("id")
      .eq("tournament_id", tournament.id)
      .limit(1)
      .single(),
  ]);

  const { data: tees } = course
    ? await supabase.from("tees").select("name").eq("course_id", course.id)
    : { data: [] as { name: string }[] };

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
          Radler Cup · Sessions
        </div>
      </header>

      <section className="px-6 md:px-10 pt-8 pb-20 max-w-4xl mx-auto">
        <div className="mb-12">
          <div className="text-eyebrow uppercase text-schloss-bright mb-3">
            Schedule &amp; Allowances
          </div>
          <h1 className="font-display text-hero text-ink-100 leading-[0.9] mb-4">
            Sessions
          </h1>
          <p className="text-ink-300 text-base max-w-2xl leading-relaxed">
            Tournament dates, per-session start times, formats, and handicap allowances. Changes save on blur.
          </p>
        </div>

        <SessionsEditor
          tournament={tournament}
          sessions={sessions ?? []}
          tees={tees ?? []}
        />
      </section>
    </main>
  );
}

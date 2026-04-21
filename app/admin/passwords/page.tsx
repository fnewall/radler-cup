import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { PasswordsEditor } from "@/components/admin/PasswordsEditor";

export const dynamic = "force-dynamic";

export default async function PasswordsAdminPage() {
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

  const [{ data: passwords }, { data: teams }] = await Promise.all([
    supabase
      .from("app_password")
      .select("id, role, scope, description"),
    supabase
      .from("team")
      .select("id, name")
      .eq("tournament_id", tournament.id),
  ]);

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
          Radler Cup · Passwords
        </div>
      </header>

      <section className="px-6 md:px-10 pt-8 pb-20 max-w-3xl mx-auto">
        <div className="mb-12">
          <div className="text-eyebrow uppercase text-schloss-bright mb-3">
            Access Control
          </div>
          <h1 className="font-display text-hero text-ink-100 leading-[0.9] mb-4">
            Passwords
          </h1>
          <p className="text-ink-300 text-base max-w-2xl leading-relaxed">
            View and change all four passwords. Existing passwords set before this feature can&apos;t be shown — rotate them once below and they&apos;ll appear.
          </p>
        </div>

        <PasswordsEditor
          passwords={passwords ?? []}
          teams={teams ?? []}
        />
      </section>
    </main>
  );
}

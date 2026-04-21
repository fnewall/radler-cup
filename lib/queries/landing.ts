import { createClient } from "@/lib/supabase/server";
import type { Tournament, TeamWithCaptain, Session } from "@/lib/supabase/types";

export type LandingData = {
  tournament: Tournament;
  teams: TeamWithCaptain[];
  sessions: Session[];
};

export async function getLandingData(): Promise<LandingData | null> {
  const supabase = await createClient();

  const { data: tournament, error: tErr } = await supabase
    .from("tournament")
    .select("*")
    .limit(1)
    .single();

  if (tErr || !tournament) {
    console.error("Failed to load tournament:", tErr);
    return null;
  }

  const { data: teamsRaw, error: teamErr } = await supabase
    .from("team")
    .select("*")
    .eq("tournament_id", tournament.id)
    .order("display_order", { ascending: true, nullsFirst: false });

  if (teamErr || !teamsRaw) {
    console.error("Failed to load teams:", teamErr);
    return null;
  }

  const { data: players, error: pErr } = await supabase
    .from("player")
    .select("id, team_id, display_name, handicap")
    .eq("tournament_id", tournament.id);

  if (pErr || !players) {
    console.error("Failed to load players:", pErr);
    return null;
  }

  const teams: TeamWithCaptain[] = teamsRaw.map((team) => {
    const teamPlayers = players.filter((p) => p.team_id === team.id);
    const captain =
      teamPlayers.find((p) => p.id === team.captain_player_id) ?? null;
    const totalHandicap = teamPlayers.reduce(
      (sum, p) => sum + (p.handicap ?? 0),
      0
    );
    const hasAnyHandicaps = teamPlayers.some((p) => p.handicap !== null);

    return {
      ...team,
      captain: captain
        ? { id: captain.id, display_name: captain.display_name }
        : null,
      player_count: teamPlayers.length,
      handicap_total: hasAnyHandicaps ? totalHandicap : null,
    };
  });

  const { data: sessions, error: sErr } = await supabase
    .from("session")
    .select("*")
    .eq("tournament_id", tournament.id)
    .order("session_number", { ascending: true });

  if (sErr || !sessions) {
    console.error("Failed to load sessions:", sErr);
    return null;
  }

  return {
    tournament,
    teams,
    sessions,
  };
}

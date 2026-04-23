import { createAdminClient } from "@/lib/supabase/admin";

export type CaptainContext = {
  tournament: {
    id: string;
    name: string;
  };
  team: {
    id: string;
    name: string;
    display_code: string;
    colour_primary: string;
    captain_player_id: string | null;
  };
  roster: Array<{
    id: string;
    display_name: string;
    handicap: number | null;
    roster_order: number | null;
    available: boolean;
  }>;
  upcoming: Array<{
    id: string;
    session_number: number;
    label: string;
    format: string;
    match_count: number;
    start_at: string | null;
    pairings_revealed: boolean;
    status: "upcoming" | "in_progress" | "complete";
    my_submitted_at: string | null;
    other_submitted_at: string | null;
    my_pairing_ids: string[];
  }>;
};

export async function getCaptainContext(
  teamId: string
): Promise<CaptainContext | null> {
  const supabase = createAdminClient();

  const { data: team } = await supabase
    .from("team")
    .select("id, name, display_code, colour_primary, captain_player_id, tournament_id")
    .eq("id", teamId)
    .single();

  if (!team) return null;

  const { data: tournament } = await supabase
    .from("tournament")
    .select("id, name")
    .eq("id", team.tournament_id)
    .single();

  if (!tournament) return null;

  const { data: roster } = await supabase
    .from("player")
    .select("id, display_name, handicap, roster_order")
    .eq("team_id", teamId)
    .order("roster_order", { ascending: true, nullsFirst: false });

  const { data: sessions } = await supabase
    .from("session")
    .select("id, session_number, label, format, match_count, start_at, pairings_revealed, status")
    .eq("tournament_id", tournament.id)
    .neq("status", "complete")
    .order("session_number", { ascending: true });

  // Availability across all upcoming sessions (we'll filter by session as needed)
  const sessionIds = (sessions ?? []).map((s) => s.id);
  const { data: availabilities } = sessionIds.length
    ? await supabase
        .from("player_availability")
        .select("session_id, player_id, available")
        .in("session_id", sessionIds)
    : { data: [] };

  // Other team's id for "has the other captain submitted?" check
  const { data: otherTeams } = await supabase
    .from("team")
    .select("id")
    .eq("tournament_id", tournament.id)
    .neq("id", teamId);

  const otherTeamId = otherTeams?.[0]?.id ?? null;

  // Pairings for all upcoming sessions, both teams
  const { data: pairings } = sessionIds.length
    ? await supabase
        .from("pairing")
        .select("id, session_id, team_id, submitted_at")
        .in("session_id", sessionIds)
    : { data: [] };

  // Build the upcoming-session summary for the captain
  const upcoming = (sessions ?? []).map((s) => {
    const mine = (pairings ?? []).filter(
      (p) => p.session_id === s.id && p.team_id === teamId
    );
    const theirs = (pairings ?? []).filter(
      (p) => p.session_id === s.id && p.team_id === otherTeamId
    );

    const mineAllSubmitted =
      mine.length > 0 && mine.every((p) => p.submitted_at !== null);
    const theirsAllSubmitted =
      theirs.length > 0 && theirs.every((p) => p.submitted_at !== null);

    return {
      id: s.id,
      session_number: s.session_number,
      label: s.label,
      format: s.format,
      match_count: s.match_count,
      start_at: s.start_at,
      pairings_revealed: s.pairings_revealed,
      status: s.status as "upcoming" | "in_progress" | "complete",
      my_submitted_at: mineAllSubmitted ? (mine[0]?.submitted_at ?? null) : null,
      other_submitted_at: theirsAllSubmitted
        ? (theirs[0]?.submitted_at ?? null)
        : null,
      my_pairing_ids: mine.map((p) => p.id),
    };
  });

  // Default availability = true; override if an explicit row exists
  const availabilityByPlayerSession: Record<string, Record<string, boolean>> = {};
  for (const a of availabilities ?? []) {
    if (!availabilityByPlayerSession[a.player_id]) {
      availabilityByPlayerSession[a.player_id] = {};
    }
    availabilityByPlayerSession[a.player_id][a.session_id] = a.available;
  }

  // Use availability for the next upcoming session if any exists, for the roster list
  // (more granular availability shown on the actual pairings page)
  const rosterWithAvailability = (roster ?? []).map((p) => ({
    ...p,
    available: true, // will be refined per-session on the pairings page itself
  }));

  return {
    tournament: { id: tournament.id, name: tournament.name },
    team: {
      id: team.id,
      name: team.name,
      display_code: team.display_code,
      colour_primary: team.colour_primary,
      captain_player_id: team.captain_player_id,
    },
    roster: rosterWithAvailability,
    upcoming,
  };
}

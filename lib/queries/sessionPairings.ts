import { createAdminClient } from "@/lib/supabase/admin";

export type SessionPairingsContext = {
  tournament: { id: string; name: string };
  session: {
    id: string;
    session_number: number;
    label: string;
    format: string;
    match_count: number;
    start_at: string | null;
    pairings_revealed: boolean;
    status: "upcoming" | "in_progress" | "complete";
    handicap_allowance: unknown;
  };
  myTeam: {
    id: string;
    name: string;
    display_code: string;
    colour_primary: string;
  };
  otherTeam: {
    id: string;
    name: string;
  } | null;
  roster: Array<{
    id: string;
    display_name: string;
    handicap: number | null;
    roster_order: number | null;
    available: boolean;
  }>;
  myPairings: Array<{
    id: string;
    match_order: number;
    submitted_at: string | null;
    players: Array<{ player_id: string; slot: number }>;
  }>;
  otherSubmitted: boolean;
};

export async function getSessionPairingsContext(
  teamId: string,
  sessionId: string
): Promise<SessionPairingsContext | null> {
  const supabase = createAdminClient();

  const { data: team } = await supabase
    .from("team")
    .select("id, name, display_code, colour_primary, tournament_id")
    .eq("id", teamId)
    .single();

  if (!team) return null;

  const { data: tournament } = await supabase
    .from("tournament")
    .select("id, name")
    .eq("id", team.tournament_id)
    .single();

  if (!tournament) return null;

  const { data: session } = await supabase
    .from("session")
    .select("id, session_number, label, format, match_count, start_at, pairings_revealed, status, handicap_allowance, tournament_id")
    .eq("id", sessionId)
    .single();

  if (!session || session.tournament_id !== tournament.id) return null;

  const { data: roster } = await supabase
    .from("player")
    .select("id, display_name, handicap, roster_order")
    .eq("team_id", teamId)
    .order("roster_order", { ascending: true, nullsFirst: false });

  const { data: availabilities } = await supabase
    .from("player_availability")
    .select("player_id, available")
    .eq("session_id", sessionId);

  const availabilityMap: Record<string, boolean> = {};
  for (const a of availabilities ?? []) {
    availabilityMap[a.player_id] = a.available;
  }

  const rosterWithAvailability = (roster ?? []).map((p) => ({
    id: p.id,
    display_name: p.display_name,
    handicap: p.handicap,
    roster_order: p.roster_order,
    available: availabilityMap[p.id] ?? true,
  }));

  const { data: myPairingsRaw } = await supabase
    .from("pairing")
    .select("id, match_order, submitted_at")
    .eq("session_id", sessionId)
    .eq("team_id", teamId)
    .order("match_order", { ascending: true });

  const pairingIds = (myPairingsRaw ?? []).map((p) => p.id);
  const { data: pairingPlayers } = pairingIds.length
    ? await supabase
        .from("pairing_player")
        .select("pairing_id, player_id, slot")
        .in("pairing_id", pairingIds)
    : { data: [] };

  const myPairings = (myPairingsRaw ?? []).map((p) => ({
    id: p.id,
    match_order: p.match_order,
    submitted_at: p.submitted_at,
    players: (pairingPlayers ?? [])
      .filter((pp) => pp.pairing_id === p.id)
      .map((pp) => ({ player_id: pp.player_id, slot: pp.slot })),
  }));

  // Other team
  const { data: otherTeams } = await supabase
    .from("team")
    .select("id, name")
    .eq("tournament_id", tournament.id)
    .neq("id", teamId);

  const otherTeam = otherTeams?.[0] ?? null;

  let otherSubmitted = false;
  if (otherTeam) {
    const { data: otherPairings } = await supabase
      .from("pairing")
      .select("submitted_at")
      .eq("session_id", sessionId)
      .eq("team_id", otherTeam.id);
    otherSubmitted =
      (otherPairings?.length ?? 0) > 0 &&
      (otherPairings ?? []).every((p) => p.submitted_at !== null);
  }

  return {
    tournament: { id: tournament.id, name: tournament.name },
    session: {
      id: session.id,
      session_number: session.session_number,
      label: session.label,
      format: session.format,
      match_count: session.match_count,
      start_at: session.start_at,
      pairings_revealed: session.pairings_revealed,
      status: session.status,
      handicap_allowance: session.handicap_allowance,
    },
    myTeam: {
      id: team.id,
      name: team.name,
      display_code: team.display_code,
      colour_primary: team.colour_primary,
    },
    otherTeam,
    roster: rosterWithAvailability,
    myPairings,
    otherSubmitted,
  };
}

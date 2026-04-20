// TypeScript types for database tables.
// We'll expand this as we add more queries.

export type Team = {
  id: string;
  tournament_id: string;
  name: string;
  display_code: string;
  colour_primary: string;
  colour_dark_text: string;
  colour_bg_tint: string;
  colour_border: string;
  captain_player_id: string | null;
};

export type Player = {
  id: string;
  tournament_id: string;
  team_id: string;
  display_name: string;
  handicap: number | null;
  roster_order: number | null;
};

export type Tournament = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  points_to_win: number;
  points_to_tie: number;
  timezone: string;
  tiebreaker_rule: string | null;
};

export type Session = {
  id: string;
  tournament_id: string;
  session_number: number;
  label: string;
  day_number: number;
  start_at: string | null;
  format: "foursomes" | "betterball" | "greensomes" | "scramble_2v2" | "singles";
  match_count: number;
  points_per_match: number;
  tees_used: string | null;
  pairings_revealed: boolean;
  status: "upcoming" | "in_progress" | "complete";
};

// Derived/joined shapes used in the UI
export type TeamWithCaptain = Team & {
  captain: Pick<Player, "id" | "display_name"> | null;
  player_count: number;
  handicap_total: number | null;
};

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

type Slot = {
  match_order: number;
  player_ids: string[]; // 1 for singles, 2 for pairs
};

type Body = {
  session_id: string;
  slots: Slot[];
  submit: boolean; // true = lock and check for reveal; false = save as draft
};

function formatSlotSize(format: string): 1 | 2 {
  return format === "singles" ? 1 : 2;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "captain" || !session.scope) {
    if (session?.role === "admin") {
      // admins must specify scope via body below
    } else {
      return NextResponse.json({ error: "Captain access required" }, { status: 403 });
    }
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.session_id || !Array.isArray(body.slots)) {
    return NextResponse.json({ error: "session_id and slots required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Identify the team this captain controls
  // Admin path would need more scaffolding — for now only true captains hit this.
  const teamId = session?.scope;
  if (!teamId) {
    return NextResponse.json({ error: "No team scope on session" }, { status: 403 });
  }

  const { data: sessionRow } = await supabase
    .from("session")
    .select("id, format, match_count, pairings_revealed, tournament_id")
    .eq("id", body.session_id)
    .single();

  if (!sessionRow) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (sessionRow.pairings_revealed) {
    return NextResponse.json({ error: "Pairings already revealed" }, { status: 409 });
  }

  // Ensure captain's team belongs to this tournament
  const { data: team } = await supabase
    .from("team")
    .select("id, tournament_id")
    .eq("id", teamId)
    .single();
  if (!team || team.tournament_id !== sessionRow.tournament_id) {
    return NextResponse.json({ error: "Team mismatch" }, { status: 403 });
  }

  // Validate slots shape
  const expectedSize = formatSlotSize(sessionRow.format);
  const orders = new Set<number>();
  const allPlayerIds = new Set<string>();

  for (const slot of body.slots) {
    if (
      typeof slot.match_order !== "number" ||
      slot.match_order < 1 ||
      slot.match_order > sessionRow.match_count
    ) {
      return NextResponse.json(
        { error: `Invalid match_order: ${slot.match_order}` },
        { status: 400 }
      );
    }
    if (orders.has(slot.match_order)) {
      return NextResponse.json(
        { error: `Duplicate match_order: ${slot.match_order}` },
        { status: 400 }
      );
    }
    orders.add(slot.match_order);

    if (!Array.isArray(slot.player_ids) || slot.player_ids.length !== expectedSize) {
      return NextResponse.json(
        { error: `Slot ${slot.match_order} expected ${expectedSize} player(s)` },
        { status: 400 }
      );
    }
    for (const pid of slot.player_ids) {
      if (typeof pid !== "string") {
        return NextResponse.json({ error: "Invalid player_id" }, { status: 400 });
      }
      if (allPlayerIds.has(pid)) {
        return NextResponse.json(
          { error: "A player cannot appear in more than one pairing" },
          { status: 400 }
        );
      }
      allPlayerIds.add(pid);
    }
  }

  // On submit: all match_count slots must be filled
  if (body.submit && body.slots.length !== sessionRow.match_count) {
    return NextResponse.json(
      { error: `Must fill all ${sessionRow.match_count} slots to submit` },
      { status: 400 }
    );
  }

  // Verify all players are on this team and available
  if (allPlayerIds.size > 0) {
    const { data: playerCheck } = await supabase
      .from("player")
      .select("id, team_id")
      .in("id", Array.from(allPlayerIds));

    for (const p of playerCheck ?? []) {
      if (p.team_id !== teamId) {
        return NextResponse.json(
          { error: "A player not on your team was selected" },
          { status: 400 }
        );
      }
    }

    const { data: unavail } = await supabase
      .from("player_availability")
      .select("player_id, available")
      .eq("session_id", body.session_id)
      .in("player_id", Array.from(allPlayerIds));

    for (const a of unavail ?? []) {
      if (a.available === false) {
        return NextResponse.json(
          { error: "An unavailable player was selected" },
          { status: 400 }
        );
      }
    }
  }

  // Wipe existing pairings for this team+session, rewrite
  const { data: existingPairings } = await supabase
    .from("pairing")
    .select("id, submitted_at")
    .eq("session_id", body.session_id)
    .eq("team_id", teamId);

  const alreadySubmitted = (existingPairings ?? []).some(
    (p) => p.submitted_at !== null
  );
  if (alreadySubmitted) {
    return NextResponse.json(
      { error: "Already submitted — contact admin to make changes" },
      { status: 409 }
    );
  }

  if (existingPairings && existingPairings.length > 0) {
    const ids = existingPairings.map((p) => p.id);
    await supabase.from("pairing_player").delete().in("pairing_id", ids);
    await supabase.from("pairing").delete().in("id", ids);
  }

  // Insert new pairings
  const submitTs = body.submit ? new Date().toISOString() : null;
  const pairingRows = body.slots.map((s) => ({
    session_id: body.session_id,
    team_id: teamId,
    match_order: s.match_order,
    submitted_at: submitTs,
  }));

  const { data: inserted, error: insertErr } = await supabase
    .from("pairing")
    .insert(pairingRows)
    .select("id, match_order");

  if (insertErr || !inserted) {
    console.error("Failed to insert pairings:", insertErr);
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  }

  // Insert pairing_player rows
  const ppRows: { pairing_id: string; player_id: string; slot: number }[] = [];
  for (const slot of body.slots) {
    const p = inserted.find((x) => x.match_order === slot.match_order);
    if (!p) continue;
    slot.player_ids.forEach((pid, idx) => {
      ppRows.push({
        pairing_id: p.id,
        player_id: pid,
        slot: idx + 1,
      });
    });
  }

  if (ppRows.length > 0) {
    const { error: ppErr } = await supabase.from("pairing_player").insert(ppRows);
    if (ppErr) {
      console.error("Failed to insert pairing_players:", ppErr);
      return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    }
  }

  // On submit: check if other team has also submitted → reveal & create matches
  if (body.submit) {
    await maybeRevealSession(body.session_id, teamId, sessionRow.tournament_id);
  }

  return NextResponse.json({ ok: true, submitted: body.submit });
}

async function maybeRevealSession(
  sessionId: string,
  myTeamId: string,
  tournamentId: string
) {
  const supabase = createAdminClient();

  const { data: otherTeams } = await supabase
    .from("team")
    .select("id")
    .eq("tournament_id", tournamentId)
    .neq("id", myTeamId);

  const otherTeamId = otherTeams?.[0]?.id;
  if (!otherTeamId) return;

  const { data: otherPairings } = await supabase
    .from("pairing")
    .select("id, match_order, submitted_at")
    .eq("session_id", sessionId)
    .eq("team_id", otherTeamId);

  const otherSubmitted =
    (otherPairings?.length ?? 0) > 0 &&
    (otherPairings ?? []).every((p) => p.submitted_at !== null);

  if (!otherSubmitted) return;

  // Both submitted → create match rows pairing up by match_order
  const { data: myPairings } = await supabase
    .from("pairing")
    .select("id, match_order")
    .eq("session_id", sessionId)
    .eq("team_id", myTeamId);

  // Convention: team_a = first team alphabetically by display_order
  // but simpler: team_a is the team with the lower display_order.
  const { data: teams } = await supabase
    .from("team")
    .select("id, display_order")
    .eq("tournament_id", tournamentId)
    .order("display_order", { ascending: true, nullsFirst: false });

  if (!teams || teams.length < 2) return;
  const teamAId = teams[0].id;
  const teamBId = teams[1].id;

  const aPairings = teamAId === myTeamId ? myPairings : otherPairings;
  const bPairings = teamAId === myTeamId ? otherPairings : myPairings;

  const matchRows: {
    session_id: string;
    match_order: number;
    team_a_pairing_id: string;
    team_b_pairing_id: string;
    status: string;
  }[] = [];

  for (const ap of aPairings ?? []) {
    const bp = (bPairings ?? []).find((x) => x.match_order === ap.match_order);
    if (!bp) continue;
    matchRows.push({
      session_id: sessionId,
      match_order: ap.match_order,
      team_a_pairing_id: ap.id,
      team_b_pairing_id: bp.id,
      status: "pending",
    });
  }

  if (matchRows.length > 0) {
    // Upsert by (session_id, match_order)
    await supabase
      .from("match")
      .delete()
      .eq("session_id", sessionId);
    await supabase.from("match").insert(matchRows);
  }

  await supabase
    .from("session")
    .update({ pairings_revealed: true })
    .eq("id", sessionId);
}

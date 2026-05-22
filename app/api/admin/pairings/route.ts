import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

type Action =
  | "unlock"
  | "reveal"
  | "add_pairing"
  | "delete_pairing"
  | "add_player"
  | "remove_player";

type Body = {
  action: Action;
  session_id: string;
  team_id?: string;
  pairing_id?: string;
  player_id?: string;
  match_order?: number;
};

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 }
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.action || !body.session_id) {
    return NextResponse.json(
      { error: "action and session_id required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data: sessionRow } = await supabase
    .from("session")
    .select("id, format, match_count, pairings_revealed, tournament_id")
    .eq("id", body.session_id)
    .single();

  if (!sessionRow) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  switch (body.action) {
    case "unlock":
      return handleUnlock(body, sessionRow);
    case "reveal":
      return handleReveal(body, sessionRow);
    case "add_pairing":
      return handleAddPairing(body, sessionRow);
    case "delete_pairing":
      return handleDeletePairing(body, sessionRow);
    case "add_player":
      return handleAddPlayer(body, sessionRow);
    case "remove_player":
      return handleRemovePlayer(body, sessionRow);
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}

type SessionRow = {
  id: string;
  format: string;
  match_count: number;
  pairings_revealed: boolean;
  tournament_id: string;
};

async function handleUnlock(body: Body, sess: SessionRow) {
  if (!body.team_id) {
    return NextResponse.json({ error: "team_id required" }, { status: 400 });
  }
  if (sess.pairings_revealed) {
    return NextResponse.json(
      { error: "Pairings already revealed — edits push live" },
      { status: 409 }
    );
  }
  const supabase = createAdminClient();
  await supabase
    .from("pairing")
    .update({ submitted_at: null, submitted_by_captain_id: null })
    .eq("session_id", body.session_id)
    .eq("team_id", body.team_id);
  return NextResponse.json({ ok: true });
}

async function handleReveal(body: Body, sess: SessionRow) {
  if (sess.pairings_revealed) {
    return NextResponse.json(
      { error: "Already revealed" },
      { status: 409 }
    );
  }
  const supabase = createAdminClient();

  const { data: teams } = await supabase
    .from("team")
    .select("id, display_order")
    .eq("tournament_id", sess.tournament_id)
    .order("display_order", { ascending: true, nullsFirst: false });
  if (!teams || teams.length < 2) {
    return NextResponse.json({ error: "Need two teams" }, { status: 400 });
  }
  const teamAId = teams[0].id;
  const teamBId = teams[1].id;

  const { data: pairings } = await supabase
    .from("pairing")
    .select("id, team_id, match_order")
    .eq("session_id", body.session_id)
    .order("match_order", { ascending: true });

  const aSorted = (pairings ?? [])
    .filter((p) => p.team_id === teamAId)
    .sort((a, b) => a.match_order - b.match_order);
  const bSorted = (pairings ?? [])
    .filter((p) => p.team_id === teamBId)
    .sort((a, b) => a.match_order - b.match_order);
  const finalCount = Math.min(aSorted.length, bSorted.length);
  if (finalCount === 0) {
    return NextResponse.json(
      { error: "Both teams need at least 1 pairing" },
      { status: 400 }
    );
  }

  // Renumber pairings 1..finalCount, contiguous
  for (let i = 0; i < finalCount; i++) {
    const order = i + 1;
    if (aSorted[i].match_order !== order) {
      await supabase
        .from("pairing")
        .update({ match_order: order })
        .eq("id", aSorted[i].id);
    }
    if (bSorted[i].match_order !== order) {
      await supabase
        .from("pairing")
        .update({ match_order: order })
        .eq("id", bSorted[i].id);
    }
  }

  // Mark all pairings submitted
  await supabase
    .from("pairing")
    .update({ submitted_at: new Date().toISOString() })
    .eq("session_id", body.session_id)
    .is("submitted_at", null);

  // Create matches
  const matchRows = [];
  for (let i = 0; i < finalCount; i++) {
    matchRows.push({
      session_id: body.session_id,
      match_order: i + 1,
      team_a_pairing_id: aSorted[i].id,
      team_b_pairing_id: bSorted[i].id,
      status: "pending",
    });
  }
  await supabase.from("match").delete().eq("session_id", body.session_id);
  await supabase.from("match").insert(matchRows);

  await supabase
    .from("session")
    .update({ pairings_revealed: true })
    .eq("id", body.session_id);

  return NextResponse.json({ ok: true });
}

async function handleAddPairing(body: Body, sess: SessionRow) {
  if (!body.team_id || typeof body.match_order !== "number") {
    return NextResponse.json(
      { error: "team_id and match_order required" },
      { status: 400 }
    );
  }
  if (body.match_order < 1 || body.match_order > sess.match_count) {
    return NextResponse.json(
      { error: `match_order must be 1..${sess.match_count}` },
      { status: 400 }
    );
  }
  const supabase = createAdminClient();

  // If match_order already taken by this team, push a unique higher slot
  const { data: existing } = await supabase
    .from("pairing")
    .select("match_order")
    .eq("session_id", body.session_id)
    .eq("team_id", body.team_id);

  const taken = new Set((existing ?? []).map((p) => p.match_order));
  let order = body.match_order;
  while (taken.has(order) && order <= sess.match_count) order++;
  if (order > sess.match_count) {
    return NextResponse.json(
      { error: "No more match_order slots available" },
      { status: 400 }
    );
  }

  await supabase.from("pairing").insert({
    session_id: body.session_id,
    team_id: body.team_id,
    match_order: order,
    submitted_at: sess.pairings_revealed ? new Date().toISOString() : null,
  });

  return NextResponse.json({ ok: true });
}

async function handleDeletePairing(body: Body, sess: SessionRow) {
  if (!body.pairing_id) {
    return NextResponse.json(
      { error: "pairing_id required" },
      { status: 400 }
    );
  }
  const supabase = createAdminClient();

  // If revealed, also delete the match that depends on this pairing
  if (sess.pairings_revealed) {
    await supabase
      .from("match")
      .delete()
      .or(
        `team_a_pairing_id.eq.${body.pairing_id},team_b_pairing_id.eq.${body.pairing_id}`
      );
  }

  await supabase
    .from("pairing_player")
    .delete()
    .eq("pairing_id", body.pairing_id);
  await supabase.from("pairing").delete().eq("id", body.pairing_id);

  return NextResponse.json({ ok: true });
}

async function handleAddPlayer(body: Body, sess: SessionRow) {
  if (!body.pairing_id || !body.player_id) {
    return NextResponse.json(
      { error: "pairing_id and player_id required" },
      { status: 400 }
    );
  }
  const supabase = createAdminClient();

  // Verify player not already in another pairing in this session
  const { data: existingPairings } = await supabase
    .from("pairing")
    .select("id")
    .eq("session_id", body.session_id);
  const pairingIds = (existingPairings ?? []).map((p) => p.id);

  const { data: conflicts } = await supabase
    .from("pairing_player")
    .select("pairing_id")
    .eq("player_id", body.player_id)
    .in("pairing_id", pairingIds);

  if ((conflicts ?? []).length > 0) {
    return NextResponse.json(
      { error: "Player already in another pairing this session" },
      { status: 400 }
    );
  }

  // Count current slots in target pairing
  const { data: current } = await supabase
    .from("pairing_player")
    .select("slot")
    .eq("pairing_id", body.pairing_id);

  const maxSize = sess.format === "singles" ? 1 : 2;
  if ((current ?? []).length >= maxSize) {
    return NextResponse.json({ error: "Pairing is full" }, { status: 400 });
  }

  const nextSlot = (current ?? []).length + 1;
  await supabase.from("pairing_player").insert({
    pairing_id: body.pairing_id,
    player_id: body.player_id,
    slot: nextSlot,
  });

  return NextResponse.json({ ok: true });
}

async function handleRemovePlayer(body: Body, sess: SessionRow) {
  if (!body.pairing_id || !body.player_id) {
    return NextResponse.json(
      { error: "pairing_id and player_id required" },
      { status: 400 }
    );
  }
  const supabase = createAdminClient();

  await supabase
    .from("pairing_player")
    .delete()
    .eq("pairing_id", body.pairing_id)
    .eq("player_id", body.player_id);

  // Resequence slots on remaining players so slots stay 1..N
  const { data: remaining } = await supabase
    .from("pairing_player")
    .select("player_id, slot")
    .eq("pairing_id", body.pairing_id)
    .order("slot", { ascending: true });

  for (let i = 0; i < (remaining ?? []).length; i++) {
    const wanted = i + 1;
    if (remaining![i].slot !== wanted) {
      await supabase
        .from("pairing_player")
        .update({ slot: wanted })
        .eq("pairing_id", body.pairing_id)
        .eq("player_id", remaining![i].player_id);
    }
  }

  return NextResponse.json({ ok: true });
}

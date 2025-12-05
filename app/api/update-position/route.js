import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseAdmin";

export async function POST(request) {
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured on the server" },
      { status: 500 }
    );
  }
  const body = await request.json();
  const { playerId, position, gameId } = body; // position: [lng, lat]

  const trimmedGameId = (gameId || "").trim().toUpperCase();

  if (!trimmedGameId) {
    return NextResponse.json({ error: "Game ID is required" }, { status: 400 });
  }
  if (!playerId || !Array.isArray(position) || position.length !== 2) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const [lng, lat] = position;

  const { error } = await supabase
    .from("players")
    .update({
      position_lng: lng,
      position_lat: lat,
      updated_at: new Date().toISOString()
    })
    .eq("id", playerId)
    .eq("game_id", trimmedGameId);

  if (error) {
    console.error("Error updating position:", error);
    return NextResponse.json(
      { error: "Could not update position" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

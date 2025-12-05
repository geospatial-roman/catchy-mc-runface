import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseAdmin";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const gameId = searchParams.get("gameId");
  const trimmedGameId = (gameId || "").trim().toUpperCase();

  if (!trimmedGameId) {
    return NextResponse.json({ error: "Game ID is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("players")
    .select("id, name, role, color, position_lng, position_lat")
    .eq("game_id", trimmedGameId);

  if (error) {
    console.error("Error fetching players:", error);
    return NextResponse.json(
      { error: "Could not load players" },
      { status: 500 }
    );
  }

  const players = (data || []).map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role,
    color: p.color,
    position:
      p.position_lng != null && p.position_lat != null
        ? [p.position_lng, p.position_lat]
        : null
  }));

  return NextResponse.json(players);
}

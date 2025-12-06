import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseAdmin";

export async function GET(request) {
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured on the server" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const gameId = searchParams.get("gameId");
  const roleParam = searchParams.get("role"); // 'mr_x' | 'detective' or null
  const trimmedGameId = (gameId || "").trim().toUpperCase();
  const role = (roleParam || "").toLowerCase();

  if (!trimmedGameId) {
    return NextResponse.json({ error: "Game ID is required" }, { status: 400 });
  }

  let query = supabase
    .from("chat_messages")
    .select("id, sender_name, message, created_at, channel, player_id")
    .eq("game_id", trimmedGameId)
    .order("created_at", { ascending: true })
    .limit(100);

  // Mr. X / unknown → only 'all' channel
  if (role !== "detective") {
    query = query.eq("channel", "all");
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error loading chat messages:", error);
    return NextResponse.json(
      { error: "Could not load messages" },
      { status: 500 }
    );
  }

  return NextResponse.json(data || []);
}

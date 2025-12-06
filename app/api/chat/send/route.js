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
  const { gameId, playerId, name, message, channel } = body;

  const trimmedGameId = (gameId || "").trim().toUpperCase();

  if (!trimmedGameId) {
    return NextResponse.json({ error: "Game ID is required" }, { status: 400 });
  }
  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Sender name is required" }, { status: 400 });
  }
  if (!message || !message.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const finalChannel = channel === "detectives" ? "detectives" : "all";

  // If sending to detectives-only, verify sender is a detective
  if (finalChannel === "detectives") {
    if (!playerId) {
      return NextResponse.json(
        { error: "Only detectives can use the detectives chat" },
        { status: 403 }
      );
    }

    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("role")
      .eq("id", playerId)
      .eq("game_id", trimmedGameId)
      .maybeSingle();

    if (playerError) {
      console.error("Error checking player role for chat:", playerError);
      return NextResponse.json(
        { error: "Could not verify player role" },
        { status: 500 }
      );
    }

    if (!player || player.role !== "detective") {
      return NextResponse.json(
        { error: "Only detectives can use the detectives chat" },
        { status: 403 }
      );
    }
  }

  const { error } = await supabase.from("chat_messages").insert({
    game_id: trimmedGameId,
    player_id: playerId || null,
    sender_name: name.trim(),
    message: message.trim(),
    channel: finalChannel
  });

  if (error) {
    console.error("Error sending chat message:", error);
    return NextResponse.json(
      { error: "Could not send message" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

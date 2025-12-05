import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseAdmin";
import { detectiveColors, generateGameId } from "@/lib/colors";

export async function POST(request) {
  const body = await request.json();
  const { name, role: requestedRole, gameId } = body;

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const cleanName = name.trim();
  const trimmedGameId = (gameId || "").trim().toUpperCase();

  // 1. Load or create game
  let finalGameId = trimmedGameId;

  if (!finalGameId) {
    // Create new game
    finalGameId = generateGameId();
    const { error: gameInsertError } = await supabase
      .from("games")
      .insert({ id: finalGameId });

    if (gameInsertError) {
      console.error("Error creating game:", gameInsertError);
      return NextResponse.json(
        { error: "Could not create game" },
        { status: 500 }
      );
    }
  } else {
    const { data: game, error: gameError } = await supabase
      .from("games")
      .select("id")
      .eq("id", finalGameId)
      .maybeSingle();

    if (gameError) {
      console.error("Error fetching game:", gameError);
      return NextResponse.json(
        { error: "Could not load game" },
        { status: 500 }
      );
    }

    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }
  }

  // 2. Get current players in this game
  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("*")
    .eq("game_id", finalGameId);

  if (playersError) {
    console.error("Error fetching players:", playersError);
    return NextResponse.json(
      { error: "Could not load players" },
      { status: 500 }
    );
  }

  const allPlayers = players || [];

  // 3. Decide role
  let role = requestedRole === "mr_x" ? "mr_x" : "detective";

  // enforce single Mr. X
  if (role === "mr_x") {
    const existingMrX = allPlayers.find((p) => p.role === "mr_x");
    if (existingMrX) {
      return NextResponse.json(
        { error: "Mr. X is already taken in this game. Please choose Detective." },
        { status: 400 }
      );
    }
  }

  // 4. Assign color for detectives
  let color = null;
  if (role === "detective") {
    const usedColors = allPlayers
      .filter((p) => p.role === "detective" && p.color)
      .map((p) => p.color);

    const availableColor =
      detectiveColors.find((c) => !usedColors.includes(c)) ||
      detectiveColors[allPlayers.length % detectiveColors.length];

    color = availableColor;
  }

  // 5. Insert player
  const { data: inserted, error: insertError } = await supabase
    .from("players")
    .insert({
      game_id: finalGameId,
      name: cleanName,
      role,
      color
    })
    .select("id, role, color")
    .single();

  if (insertError) {
    console.error("Error inserting player:", insertError);
    return NextResponse.json(
      { error: "Could not join game" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    playerId: inserted.id,
    role: inserted.role,
    color: inserted.color,
    gameId: finalGameId
  });
}

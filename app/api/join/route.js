import { NextResponse } from "next/server";
import { games, detectiveColors, findGame, createGame } from "../state";

export async function POST(request) {
  const body = await request.json();
  const { name, role: requestedRole, gameId } = body;

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const cleanName = name.trim();

  // Determine which game to use
  const trimmedGameId = (gameId || "").trim().toUpperCase();

  let game;
  if (!trimmedGameId) {
    // No gameId -> create a new game automatically
    game = createGame();
  } else {
    game = findGame(trimmedGameId);
    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }
  }

  // Validate requested role
  let role = requestedRole === "mr_x" ? "mr_x" : "detective";

  // Enforce single Mr. X per game
  if (role === "mr_x") {
    const existingMrX = game.players.find((p) => p.role === "mr_x");
    if (existingMrX) {
      return NextResponse.json(
        { error: "Mr. X is already taken in this game. Please choose Detective." },
        { status: 400 }
      );
    }
  }

  // Assign color for detectives in this game
  let color = null;
  if (role === "detective") {
    const usedColors = game.players
      .filter((p) => p.role === "detective" && p.color)
      .map((p) => p.color);

    const availableColor =
      detectiveColors.find((c) => !usedColors.includes(c)) ||
      detectiveColors[game.players.length % detectiveColors.length];

    color = availableColor;
  }

  const id = crypto.randomUUID();

  game.players.push({
    id,
    name: cleanName,
    role,
    color,
    position: undefined,
    route: []
  });

  return NextResponse.json({ playerId: id, role, color, gameId: game.id });
}

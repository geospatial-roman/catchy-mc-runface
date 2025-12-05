import { NextResponse } from "next/server";
import { findGame } from "../state";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const gameId = searchParams.get("gameId");

  if (!gameId) {
    return NextResponse.json({ error: "Game ID is required" }, { status: 400 });
  }

  const game = findGame(gameId.trim().toUpperCase());
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  return NextResponse.json(game.players);
}

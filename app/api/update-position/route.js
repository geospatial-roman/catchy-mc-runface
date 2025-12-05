import { NextResponse } from "next/server";
import { findGame } from "../state";

export async function POST(request) {
  const body = await request.json();
  const { playerId, position, gameId } = body; // [lng, lat]

  if (!gameId || !gameId.trim()) {
    return NextResponse.json({ error: "Game ID is required" }, { status: 400 });
  }
  if (!playerId || !Array.isArray(position) || position.length !== 2) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const game = findGame(gameId.trim().toUpperCase());
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const player = game.players.find((p) => p.id === playerId);
  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  player.position = position;
  player.route.push({ t: Date.now(), p: position });

  return NextResponse.json({ ok: true });
}

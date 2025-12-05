import { NextResponse } from "next/server";
import { createGame } from "../state";

export async function POST() {
  const game = createGame();
  return NextResponse.json({ gameId: game.id });
}

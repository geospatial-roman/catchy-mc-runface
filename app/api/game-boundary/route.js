import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseAdmin";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const gameId = searchParams.get("gameId");

  if (!gameId) {
    return NextResponse.json(
      { error: "Missing gameId" },
      { status: 400 }
    );
  }

  const supabase = createClient();

  const { data, error } = await supabase
    .from("game_boundaries")
    .select("boundary")
    .eq("game_id", gameId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.error("Supabase GET game_boundary error:", error);
    return NextResponse.json(
      { error: "Database error" },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json({ boundary: null });
  }

  return NextResponse.json({ boundary: data.boundary });
}

export async function POST(req) {
  const body = await req.json();
  const { gameId, boundary } = body || {};

  if (!gameId || !boundary) {
    return NextResponse.json(
      { error: "Missing gameId or boundary" },
      { status: 400 }
    );
  }

  const supabase = createClient();

  const { error } = await supabase
    .from("game_boundaries")
    .upsert(
      { game_id: gameId, boundary },
      { onConflict: "game_id" }
    );

  if (error) {
    console.error("Supabase POST game_boundary error:", error);
    return NextResponse.json(
      { error: "Database error" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

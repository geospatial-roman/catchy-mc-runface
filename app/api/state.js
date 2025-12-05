// Simple in-memory store for MVP.
// NOTE: This resets whenever the serverless function reloads.
// For production, use a real database.

export const detectiveColors = [
  "blue",
  "green",
  "orange",
  "purple",
  "teal",
  "brown",
  "magenta",
  "cyan"
];

// games: [{ id: string, players: Player[] }]
export const games = [];

// Player shape (for your reference):
// {
//   id: string,
//   name: string,
//   role: "mr_x" | "detective",
//   color: string | null,
//   position?: [lng, lat],
//   route: [{ t: number, p: [lng, lat] }]
// }

function generateGameId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export function createGame() {
  let id;
  do {
    id = generateGameId();
  } while (games.some((g) => g.id === id));

  const game = { id, players: [] };
  games.push(game);
  return game;
}

export function findGame(gameId) {
  return games.find((g) => g.id === gameId);
}

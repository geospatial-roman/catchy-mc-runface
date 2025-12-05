// lib/colors.js
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

const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateGameId() {
  let id = "";
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

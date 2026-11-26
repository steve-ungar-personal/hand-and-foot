import { NextResponse } from "next/server";
import { cleanName, teamProblem } from "@/lib/game";

export const fail = (e: unknown) =>
  NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });

/** Cleans and validates a { name, players } request body. */
export function readTeam(body: unknown): { name: string; players: string[] } | { error: string } {
  const b = body as { name?: unknown; players?: unknown } | null;
  if (typeof b?.name !== "string" || !Array.isArray(b.players) || !b.players.every((p) => typeof p === "string"))
    return { error: "Invalid team" };
  const name = cleanName(b.name);
  const players = (b.players as string[]).map(cleanName).filter(Boolean);
  if (players.some((p) => p.length > 60)) return { error: "A player name is too long." };
  const problem = teamProblem(name, players);
  return problem ? { error: problem } : { name, players };
}

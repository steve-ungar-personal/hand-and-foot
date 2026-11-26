import { NextResponse } from "next/server";
import { store } from "@/lib/db";
import { newSavedTeam, sameName } from "@/lib/game";
import { fail, readTeam } from "./shared";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await store.listTeams());
  } catch (e) {
    return fail(e);
  }
}

/** Creates a team: body { name, players }. */
export async function POST(req: Request) {
  try {
    const input = readTeam(await req.json());
    if ("error" in input) return NextResponse.json({ error: input.error }, { status: 400 });
    if ((await store.listTeams()).some((t) => sameName(t.name, input.name)))
      return NextResponse.json({ error: `A team named "${input.name}" already exists.` }, { status: 409 });
    const team = newSavedTeam(input.name, input.players);
    await store.addTeam(team);
    return NextResponse.json(team);
  } catch (e) {
    return fail(e);
  }
}

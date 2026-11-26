import { NextResponse } from "next/server";
import { store } from "@/lib/db";
import { sameName } from "@/lib/game";
import { fail, readTeam } from "../shared";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ name: string }> };

/** Edit a team: body { name, players }. A new name carries over to its past games. */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const from = safeDecode((await params).name);
    const input = readTeam(await req.json());
    if ("error" in input) return NextResponse.json({ error: input.error }, { status: 400 });
    const teams = await store.listTeams();
    const current = teams.find((t) => t.name === from);
    if (!current) return NextResponse.json({ error: "That team no longer exists." }, { status: 404 });
    if (teams.some((t) => t.name !== from && sameName(t.name, input.name)))
      return NextResponse.json({ error: `A team named "${input.name}" already exists.` }, { status: 409 });
    // Taking over a name that past games use would merge the two in any later rename.
    if (!sameName(from, input.name)) {
      const used = (await store.listGames()).some((g) => g.teams.some((t) => t.name && sameName(t.name, input.name)));
      if (used)
        return NextResponse.json({ error: `Past games already have a team named "${input.name}".` }, { status: 409 });
    }
    const team = { ...current, ...input, updatedAt: new Date().toISOString() };
    await store.updateTeam(from, team);
    return NextResponse.json(team);
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    await store.deleteTeam(safeDecode((await params).name));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

/** Route params usually arrive decoded already; decode only if still encoded. */
function safeDecode(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

import { NextResponse } from "next/server";
import { store } from "@/lib/db";
import { cleanName } from "@/lib/game";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ name: string }> };

const fail = (e: unknown) =>
  NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });

/** Rename: body { name: "New name" }. */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const from = safeDecode((await params).name);
    const body = await req.json();
    const to = cleanName(String(body?.name ?? ""));
    if (!to || to.length > 60) return NextResponse.json({ error: "Enter a league name (up to 60 characters)." }, { status: 400 });
    if (to === from) return NextResponse.json({ name: to, games: 0 });
    const names = [
      ...(await store.listLeagues()).map((l) => l.name),
      ...(await store.listGames()).map((g) => g.league?.trim()).filter(Boolean),
    ];
    if (names.some((n) => n!.toLowerCase() === to.toLowerCase() && n !== from))
      return NextResponse.json({ error: `A league named "${to}" already exists.` }, { status: 409 });
    const games = await store.renameLeague(from, to);
    return NextResponse.json({ name: to, games });
  } catch (e) {
    return fail(e);
  }
}

/** Deletes the league and every game in it. */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const name = safeDecode((await params).name);
    const games = await store.deleteLeague(name);
    return NextResponse.json({ ok: true, games });
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

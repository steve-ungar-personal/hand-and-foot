import { NextResponse } from "next/server";
import { store } from "@/lib/db";
import { cleanName, isLeague } from "@/lib/game";

export const dynamic = "force-dynamic";

const fail = (e: unknown) =>
  NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });

export async function GET() {
  try {
    return NextResponse.json(await store.listLeagues());
  } catch (e) {
    return fail(e);
  }
}

/** Create or update a league (keyed by name). */
export async function PUT(req: Request) {
  try {
    const l = await req.json();
    if (!isLeague(l)) return NextResponse.json({ error: "Invalid league" }, { status: 400 });
    l.name = cleanName(l.name);
    await store.upsertLeague(l);
    return NextResponse.json(l);
  } catch (e) {
    return fail(e);
  }
}

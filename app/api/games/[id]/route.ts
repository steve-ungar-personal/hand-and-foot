import { NextResponse } from "next/server";
import { store } from "@/lib/db";
import { isGame } from "@/lib/game";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const fail = (e: unknown) =>
  NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const g = await store.getGame((await params).id);
    return g ? NextResponse.json(g) : NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const g = await req.json();
    if (!isGame(g) || g.id !== id) return NextResponse.json({ error: "Invalid game" }, { status: 400 });
    await store.upsertGame(g);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    await store.removeGame((await params).id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

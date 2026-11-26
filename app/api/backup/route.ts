import { del, list, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { store } from "@/lib/db";

export const dynamic = "force-dynamic";

const PREFIX = "backups/hand-and-foot-";
const KEEP_DAYS = 90;

/** Deletes backups older than KEEP_DAYS. Returns how many were deleted. */
async function deleteOldBackups() {
  const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
  const old: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: PREFIX, cursor });
    for (const b of page.blobs) if (b.uploadedAt.getTime() < cutoff) old.push(b.url);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  if (old.length) await del(old);
  return old.length;
}

/** Daily backup, run by the Vercel cron job in vercel.json. Saves to private Blob storage. */
export async function GET(req: Request) {
  // Vercel sends this header on cron runs. Without a secret configured, nobody gets in.
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [games, leagues, teams] = await Promise.all([store.listGames(), store.listLeagues(), store.listTeams()]);
    const savedAt = new Date().toISOString();
    // The time is part of the name, so a later run never overwrites an earlier backup.
    const { pathname } = await put(
      `${PREFIX}${savedAt.replace(/:/g, "-")}.json`,
      JSON.stringify({ savedAt, games, leagues, teams }),
      { access: "private", contentType: "application/json" },
    );
    const counts = { games: games.length, leagues: leagues.length, teams: teams.length };
    console.log("Backup saved", pathname, counts);
    // Only reached once today's backup is saved, so a failed save never removes older ones.
    const deleted = await deleteOldBackups();
    console.log("Old backups deleted:", deleted);
    return NextResponse.json({ pathname, ...counts, deleted });
  } catch (e) {
    console.error("Backup failed", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { store } from "@/lib/db";

export const dynamic = "force-dynamic";

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
      `backups/hand-and-foot-${savedAt.replace(/:/g, "-")}.json`,
      JSON.stringify({ savedAt, games, leagues, teams }),
      { access: "private", contentType: "application/json" },
    );
    const counts = { games: games.length, leagues: leagues.length, teams: teams.length };
    console.log("Backup saved", pathname, counts);
    return NextResponse.json({ pathname, ...counts });
  } catch (e) {
    console.error("Backup failed", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

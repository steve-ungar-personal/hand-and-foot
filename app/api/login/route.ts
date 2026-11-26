import { NextResponse } from "next/server";
import { authMode, passwordMatches, sessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Slows down guessing. Counts are per server instance and reset when it restarts,
// so a long password is still the main protection.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 10;
const fails = new Map<string, { count: number; since: number }>();

const error = (message: string, status: number) => NextResponse.json({ error: message }, { status });

export async function POST(req: Request) {
  if (authMode() !== "on") return error("No password is set up on this server.", 503);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  let f = fails.get(ip);
  if (!f || Date.now() - f.since > WINDOW_MS) fails.set(ip, (f = { count: 0, since: Date.now() }));
  if (f.count >= MAX_FAILS) return error("Too many tries. Wait 15 minutes.", 429);
  // Counted before checking, so simultaneous guesses can't slip past the limit.
  f.count++;

  const body = await req.json().catch(() => null);
  if (typeof body?.password !== "string" || !passwordMatches(body.password)) {
    await new Promise((r) => setTimeout(r, 1000));
    return error("Wrong password.", 401);
  }
  fails.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie());
  return res;
}

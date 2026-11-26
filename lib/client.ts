"use client";
// Client-side data access. Every game is also cached on the device so scoring keeps
// working with a bad connection; unsynced games are retried later.
import { Game, League, SavedTeam, leagueOf, newLeague } from "./game";

const KEY = (id: string) => `hf:game:${id}`;
const PENDING = "hf:pending";

function lsGet<T>(k: string): T | null {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
function lsSet(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
}
function lsDel(k: string) {
  try {
    localStorage.removeItem(k);
  } catch {}
}

// The league this device used last. Everyone shares one password, so "the user" is the device.
const LAST_LEAGUE = "hf:lastLeague";
export const getLastLeague = () => lsGet<string>(LAST_LEAGUE);
export const setLastLeague = (league: string) => lsSet(LAST_LEAGUE, league);

// League, player and team filters, shared by every page until the app is closed.
export type FilterName = "league" | "player" | "team";
const FILTER = (name: FilterName) => `hf:filter:${name}`;

/** undefined = not chosen yet; "" = chosen "all". */
export function getFilter(name: FilterName): string | undefined {
  try {
    return sessionStorage.getItem(FILTER(name)) ?? undefined;
  } catch {
    return undefined;
  }
}
export function setFilter(name: FilterName, value: string) {
  try {
    sessionStorage.setItem(FILTER(name), value);
  } catch {}
}

const pending = () => new Set(lsGet<string[]>(PENDING) ?? []);
const setPending = (s: Set<string>) => lsSet(PENDING, [...s]);

/** fetch that goes to the sign-in page if the sign-in is missing or no longer valid. */
async function api(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  if (r.status === 401 && location.pathname !== "/login")
    location.assign(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
  return r;
}

async function errorOf(r: Response) {
  try {
    return (await r.json()).error || r.statusText;
  } catch {
    return r.statusText;
  }
}

async function put(g: Game) {
  const r = await api(`/api/games/${g.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(g),
    keepalive: true,
  });
  if (!r.ok) throw new Error(await errorOf(r));
}

/** Saves locally, then to the server. Returns false if the server save failed (will retry later). */
export async function saveGame(g: Game): Promise<boolean> {
  lsSet(KEY(g.id), g);
  const p = pending();
  try {
    await put(g);
    p.delete(g.id);
    setPending(p);
    return true;
  } catch {
    p.add(g.id);
    setPending(p);
    return false;
  }
}

export async function syncPending() {
  const p = pending();
  for (const id of p) {
    const g = lsGet<Game>(KEY(id));
    if (!g) {
      p.delete(id);
      continue;
    }
    try {
      await put(g);
      p.delete(id);
    } catch {
      break;
    }
  }
  setPending(p);
}

/** All games from the server, with any unsynced local edits layered on top. */
export async function fetchGames(): Promise<Game[]> {
  await syncPending();
  const r = await api("/api/games", { cache: "no-store" });
  if (!r.ok) throw new Error(await errorOf(r));
  const games = (await r.json()) as Game[];
  const unsynced = [...pending()].map((id) => lsGet<Game>(KEY(id))).filter(Boolean) as Game[];
  const byId = new Map(games.map((g) => [g.id, g]));
  for (const g of unsynced) byId.set(g.id, g);
  return [...byId.values()].sort(
    (a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt),
  );
}

/** Returns { game, offline } — offline means the server could not be reached. */
export async function loadGame(id: string): Promise<{ game: Game | null; offline: boolean }> {
  const local = lsGet<Game>(KEY(id));
  try {
    const r = await api(`/api/games/${id}`, { cache: "no-store" });
    if (r.status === 404) return { game: local, offline: false };
    if (!r.ok) throw new Error(await errorOf(r));
    const server = (await r.json()) as Game;
    const game = local && pending().has(id) && local.updatedAt > server.updatedAt ? local : server;
    lsSet(KEY(id), game);
    return { game, offline: false };
  } catch {
    return { game: local, offline: true };
  }
}

/** All leagues: saved ones plus any league named by a game (those get default rules). */
export async function fetchLeagues(games: Game[] = []): Promise<League[]> {
  let saved: League[] = [];
  try {
    const r = await api("/api/leagues", { cache: "no-store" });
    if (r.ok) saved = await r.json();
  } catch {}
  const byName = new Map(saved.map((l) => [l.name, l]));
  for (const g of games) {
    const n = leagueOf(g);
    if (!byName.has(n)) byName.set(n, newLeague(n));
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveLeague(l: League) {
  const r = await api("/api/leagues", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...l, updatedAt: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error(await errorOf(r));
  return (await r.json()) as League;
}

export async function deleteGame(id: string) {
  const r = await api(`/api/games/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error(await errorOf(r));
  lsDel(KEY(id));
  const p = pending();
  p.delete(id);
  setPending(p);
}

export async function renameLeague(from: string, to: string): Promise<{ name: string; games: number }> {
  const r = await api(`/api/leagues/${encodeURIComponent(from)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: to }),
  });
  if (!r.ok) throw new Error(await errorOf(r));
  const res = await r.json();
  if (getLastLeague() === from) setLastLeague(res.name);
  if (getFilter("league") === from) setFilter("league", res.name);
  return res;
}

export async function deleteLeague(name: string): Promise<number> {
  const r = await api(`/api/leagues/${encodeURIComponent(name)}`, { method: "DELETE" });
  if (!r.ok) throw new Error(await errorOf(r));
  if (getLastLeague() === name) lsDel(LAST_LEAGUE);
  return (await r.json()).games;
}

export async function fetchTeams(): Promise<SavedTeam[]> {
  const r = await api("/api/teams", { cache: "no-store" });
  if (!r.ok) throw new Error(await errorOf(r));
  return r.json();
}

type TeamInput = { name: string; players: string[] };

async function sendTeam(url: string, method: "POST" | "PATCH", { name, players }: TeamInput) {
  const r = await api(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, players }),
  });
  if (!r.ok) throw new Error(await errorOf(r));
  return (await r.json()) as SavedTeam;
}

/** Saves a new team. Fails if the name is already taken, so it never overwrites one. */
export const createTeam = (team: TeamInput) => sendTeam("/api/teams", "POST", team);

export const updateTeam = (from: string, team: TeamInput) =>
  sendTeam(`/api/teams/${encodeURIComponent(from)}`, "PATCH", team);

export async function deleteTeam(name: string) {
  const r = await api(`/api/teams/${encodeURIComponent(name)}`, { method: "DELETE" });
  if (!r.ok) throw new Error(await errorOf(r));
}

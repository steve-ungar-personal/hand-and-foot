// Server-side storage. Uses Neon Postgres when DATABASE_URL (or POSTGRES_URL) is set,
// otherwise a local JSON file for development. Tables are created automatically.
import "server-only";
import { neon } from "@neondatabase/serverless";
import { promises as fs } from "fs";
import path from "path";
import { DEFAULT_LEAGUE, newLeague, type Game, type League } from "./game";

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.STORAGE_URL;

interface Store {
  listGames(): Promise<Game[]>;
  getGame(id: string): Promise<Game | null>;
  upsertGame(g: Game): Promise<void>;
  removeGame(id: string): Promise<void>;
  listLeagues(): Promise<League[]>;
  upsertLeague(l: League): Promise<void>;
  /** Renames a league and moves its games. Returns the number of games moved. */
  renameLeague(from: string, to: string): Promise<number>;
  /** Deletes a league and all of its games. Returns the number of games deleted. */
  deleteLeague(name: string): Promise<number>;
}

/** League name as stored on a game (older games without one belong to the default league). */
const gameLeague = (g: Game) => g.league?.trim() || DEFAULT_LEAGUE;

const byDate = (a: Game, b: Game) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt);

function neonStore(connection: string): Store {
  const sql = neon(connection);
  let ready: Promise<unknown> | null = null;
  const init = () =>
    (ready ??= (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS games (
          id text PRIMARY KEY,
          data jsonb NOT NULL,
          played_on date NOT NULL,
          status text NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now()
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS leagues (
          name text PRIMARY KEY,
          data jsonb NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now()
        )`;
    })().catch((e) => {
      ready = null;
      throw e;
    }));

  return {
    async listGames() {
      await init();
      const rows = await sql`SELECT data FROM games ORDER BY played_on DESC, updated_at DESC`;
      return rows.map((r) => r.data as Game);
    },
    async getGame(id) {
      await init();
      const rows = await sql`SELECT data FROM games WHERE id = ${id}`;
      return rows.length ? (rows[0].data as Game) : null;
    },
    async upsertGame(g) {
      await init();
      await sql`
        INSERT INTO games (id, data, played_on, status, updated_at)
        VALUES (${g.id}, ${JSON.stringify(g)}::jsonb, ${g.date}, ${g.status}, now())
        ON CONFLICT (id) DO UPDATE
          SET data = EXCLUDED.data, played_on = EXCLUDED.played_on,
              status = EXCLUDED.status, updated_at = now()`;
    },
    async removeGame(id) {
      await init();
      await sql`DELETE FROM games WHERE id = ${id}`;
    },
    async listLeagues() {
      await init();
      const rows = await sql`SELECT data FROM leagues ORDER BY name`;
      return rows.map((r) => r.data as League);
    },
    async upsertLeague(l) {
      await init();
      await sql`
        INSERT INTO leagues (name, data, updated_at)
        VALUES (${l.name}, ${JSON.stringify(l)}::jsonb, now())
        ON CONFLICT (name) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
    },
    async renameLeague(from, to) {
      await init();
      const rows = await sql`SELECT data FROM leagues WHERE name = ${from}`;
      const league: League = rows.length ? (rows[0].data as League) : newLeague(from);
      const renamed = JSON.stringify({ ...league, name: to, updatedAt: new Date().toISOString() });
      const [, , moved] = await sql.transaction([
        sql`DELETE FROM leagues WHERE name = ${from}`,
        sql`INSERT INTO leagues (name, data, updated_at) VALUES (${to}, ${renamed}::jsonb, now())`,
        sql`
          UPDATE games SET data = jsonb_set(data, '{league}', to_jsonb(${to}::text)), updated_at = now()
          WHERE COALESCE(NULLIF(btrim(data->>'league'), ''), ${DEFAULT_LEAGUE}) = ${from}
          RETURNING id`,
      ]);
      return moved.length;
    },
    async deleteLeague(name) {
      await init();
      const [deleted] = await sql.transaction([
        sql`
          DELETE FROM games
          WHERE COALESCE(NULLIF(btrim(data->>'league'), ''), ${DEFAULT_LEAGUE}) = ${name}
          RETURNING id`,
        sql`DELETE FROM leagues WHERE name = ${name}`,
      ]);
      return deleted.length;
    },
  };
}

function fileStore(): Store {
  type Db = { games: Record<string, Game>; leagues: Record<string, League> };
  const file = path.join(process.cwd(), ".data", "db.json");
  const read = async (): Promise<Db> => {
    try {
      return JSON.parse(await fs.readFile(file, "utf8"));
    } catch {
      return { games: {}, leagues: {} };
    }
  };
  const write = async (db: Db) => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(db, null, 2));
  };
  return {
    async listGames() {
      return Object.values((await read()).games).sort(byDate);
    },
    async getGame(id) {
      return (await read()).games[id] ?? null;
    },
    async upsertGame(g) {
      const db = await read();
      db.games[g.id] = g;
      await write(db);
    },
    async removeGame(id) {
      const db = await read();
      delete db.games[id];
      await write(db);
    },
    async listLeagues() {
      return Object.values((await read()).leagues).sort((a, b) => a.name.localeCompare(b.name));
    },
    async upsertLeague(l) {
      const db = await read();
      db.leagues[l.name] = l;
      await write(db);
    },
    async renameLeague(from, to) {
      const db = await read();
      const league = db.leagues[from] ?? newLeague(from);
      delete db.leagues[from];
      db.leagues[to] = { ...league, name: to, updatedAt: new Date().toISOString() };
      let moved = 0;
      for (const g of Object.values(db.games))
        if (gameLeague(g) === from) {
          g.league = to;
          moved++;
        }
      await write(db);
      return moved;
    },
    async deleteLeague(name) {
      const db = await read();
      let deleted = 0;
      for (const [id, g] of Object.entries(db.games))
        if (gameLeague(g) === name) {
          delete db.games[id];
          deleted++;
        }
      delete db.leagues[name];
      await write(db);
      return deleted;
    },
  };
}

function missingStore(): Store {
  const fail = async (): Promise<never> => {
    throw new Error(
      "Database not configured. In Vercel, open the project's Storage tab, add a Neon database, connect it to this project, then redeploy.",
    );
  };
  return {
    listGames: fail,
    getGame: fail,
    upsertGame: fail,
    removeGame: fail,
    listLeagues: fail,
    upsertLeague: fail,
    renameLeague: fail,
    deleteLeague: fail,
  };
}

export const store: Store = url ? neonStore(url) : process.env.VERCEL ? missingStore() : fileStore();

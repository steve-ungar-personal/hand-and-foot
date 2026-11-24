"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { fetchGames, fetchLeagues, getLastLeague, saveGame, saveLeague, setLastLeague } from "@/lib/client";
import {
  DEFAULT_LEAGUE,
  Game,
  League,
  cleanName,
  leagueOf,
  newGame,
  newLeague,
  teamLabel,
  todayLocal,
} from "@/lib/game";
import { allPlayerNames } from "@/lib/stats";

type Draft = { players: string[] };
const blank = (): Draft[] => [{ players: ["", ""] }, { players: ["", ""] }];
const NEW = "__new__";

export default function NewGame() {
  const router = useRouter();
  const [date, setDate] = useState(todayLocal());
  const [teams, setTeams] = useState<Draft[]>(blank);
  const [games, setGames] = useState<Game[]>([]);
  const [leagues, setLeagues] = useState<League[] | null>(null);
  const [league, setLeague] = useState(""); // league name or NEW
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const gs = await fetchGames().catch(() => [] as Game[]);
      const ls = await fetchLeagues(gs);
      setGames(gs);
      setLeagues(ls);
      const last = getLastLeague();
      if (last && ls.some((l) => l.name === last)) setLeague(last);
      else if (ls.length) setLeague(ls[0].name);
      else {
        setLeague(NEW);
        setNewName(DEFAULT_LEAGUE);
      }
    })();
  }, []);

  const leagueName = league === NEW ? cleanName(newName) : league;
  const leagueGames = useMemo(() => games.filter((g) => leagueOf(g) === leagueName), [games, leagueName]);
  const lastGame = leagueGames[0] ?? null;
  // League members first in the suggestions, then everyone else.
  const known = useMemo(() => {
    const inLeague = allPlayerNames(leagueGames);
    return [...inLeague, ...allPlayerNames(games).filter((n) => !inLeague.includes(n))];
  }, [games, leagueGames]);

  const setPlayer = (ti: number, pi: number, v: string) =>
    setTeams((ts) => ts.map((t, i) => (i !== ti ? t : { players: t.players.map((p, j) => (j === pi ? v : p)) })));
  const addPlayer = (ti: number) =>
    setTeams((ts) => ts.map((t, i) => (i !== ti ? t : { players: [...t.players, ""] })));
  const removePlayer = (ti: number, pi: number) =>
    setTeams((ts) => ts.map((t, i) => (i !== ti ? t : { players: t.players.filter((_, j) => j !== pi) })));

  // Match an existing player's spelling regardless of case.
  const canonical = (n: string) => {
    const c = cleanName(n);
    return known.find((k) => k.toLowerCase() === c.toLowerCase()) ?? c;
  };

  async function start() {
    setError("");
    if (!leagueName) return setError("Enter a league name.");
    if (leagueName.length > 60) return setError("League name is too long.");
    const cleaned = teams.map((t) => ({ players: t.players.map(canonical).filter(Boolean) }));
    if (cleaned.some((t) => t.players.length === 0)) return setError("Every team needs at least one player.");
    const all = cleaned.flatMap((t) => t.players.map((p) => p.toLowerCase()));
    if (new Set(all).size !== all.length) return setError("A player is listed twice.");

    setBusy(true);
    let lg = leagues?.find((l) => l.name.toLowerCase() === leagueName.toLowerCase());
    if (!lg) {
      lg = newLeague(leagueName);
      await saveLeague(lg).catch(() => {}); // a game naming the league still shows it later
    }
    setLastLeague(lg.name);
    const g = newGame(date, cleaned, lg.name, lg.rules);
    await saveGame(g); // falls back to device storage if offline
    router.push(`/game/${g.id}`);
  }

  return (
    <>
      <h1>New game</h1>

      <div className="card stack">
        <div>
          <label className="field" htmlFor="league">League</label>
          <select id="league" value={league} onChange={(e) => setLeague(e.target.value)} disabled={!leagues}>
            {leagues?.map((l) => (
              <option key={l.name} value={l.name}>{l.name}</option>
            ))}
            <option value={NEW}>+ New league…</option>
          </select>
        </div>
        {league === NEW && (
          <div>
            <label className="field" htmlFor="league-name">New league name</label>
            <input
              id="league-name"
              type="text"
              autoCapitalize="words"
              maxLength={60}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Tuesday Night"
            />
            <p className="small muted" style={{ margin: "6px 0 0" }}>
              Uses the standard scoring. Change it any time under <Link href="/leagues">Leagues</Link>.
            </p>
          </div>
        )}
        <div>
          <label className="field" htmlFor="date">Date played</label>
          <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value || todayLocal())} />
        </div>
      </div>

      {lastGame && (
        <button
          className="btn block"
          style={{ marginBottom: 12, flexWrap: "wrap", padding: "8px 14px" }}
          onClick={() => setTeams(lastGame.teams.map((t) => ({ players: [...t.players] })))}
        >
          ↻ Same teams as last game
          <span className="small muted" style={{ fontWeight: 400 }}>
            ({lastGame.teams.map(teamLabel).join(" vs ")})
          </span>
        </button>
      )}

      <datalist id="players">
        {known.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      {teams.map((t, ti) => (
        <div key={ti} className="card team-setup">
          <h3>
            Team {ti + 1}
            {teams.length > 2 && (
              <button className="btn sm danger" onClick={() => setTeams((ts) => ts.filter((_, i) => i !== ti))}>
                Remove team
              </button>
            )}
          </h3>
          <div className="stack">
            {t.players.map((p, pi) => (
              <div key={pi} className="row">
                <input
                  type="text"
                  className="grow"
                  list="players"
                  placeholder={`Player ${pi + 1}`}
                  autoCapitalize="words"
                  autoComplete="off"
                  value={p}
                  onChange={(e) => setPlayer(ti, pi, e.target.value)}
                />
                {t.players.length > 1 && (
                  <button className="icon-btn" aria-label="Remove player" onClick={() => removePlayer(ti, pi)}>
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          <button className="btn sm" style={{ marginTop: 10 }} onClick={() => addPlayer(ti)}>
            + Add player
          </button>
        </div>
      ))}

      {teams.length < 4 && (
        <button className="btn block" onClick={() => setTeams((ts) => [...ts, { players: ["", ""] }])}>
          + Add team
        </button>
      )}

      {error && <div className="banner err" style={{ marginTop: 12 }}>{error}</div>}

      <div className="footer-bar">
        <div className="inner">
          <button className="btn primary grow" disabled={busy || !leagues} onClick={start}>
            {busy ? "Starting…" : "Start game"}
          </button>
        </div>
      </div>
    </>
  );
}

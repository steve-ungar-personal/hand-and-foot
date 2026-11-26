"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  createTeam,
  fetchGames,
  fetchLeagues,
  fetchTeams,
  getFilter,
  saveGame,
  saveLeague,
  setFilter,
  setLastLeague,
  updateTeam,
} from "@/lib/client";
import {
  DEFAULT_LEAGUE,
  Game,
  League,
  MAX_TEAM_PLAYERS,
  SavedTeam,
  cleanName,
  leagueOf,
  newGame,
  newLeague,
  sameName,
  samePlayers,
  teamLabel,
  teamProblem,
  todayLocal,
} from "@/lib/game";
import { allPlayerNames } from "@/lib/stats";
import TeamPicker from "./TeamPicker";

/** updateSaved: replace the saved lineup of this name with these players when the game starts. */
type Draft = { name: string; players: string[]; updateSaved?: boolean };
const emptyDraft = (): Draft => ({ name: "", players: ["", ""] });
const blank = (): Draft[] => [emptyDraft(), emptyDraft()];
const NEW = "__new__";

export default function NewGame() {
  const router = useRouter();
  const [date, setDate] = useState(todayLocal());
  const [teams, setTeams] = useState<Draft[]>(blank);
  const [games, setGames] = useState<Game[]>([]);
  const [leagues, setLeagues] = useState<League[] | null>(null);
  const [league, setLeague] = useState(""); // league name or NEW
  const [newName, setNewName] = useState("");
  const [saved, setSaved] = useState<SavedTeam[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchTeams().then(setSaved).catch(() => {}); // teams can still be typed in without them
    (async () => {
      const gs = await fetchGames().catch(() => [] as Game[]);
      const ls = await fetchLeagues(gs);
      setGames(gs);
      setLeagues(ls);
      if (ls.length) setLeague(ls[0].name); // sorted by name
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
    const played = [...inLeague, ...allPlayerNames(games).filter((n) => !inLeague.includes(n))];
    return [...new Set([...played, ...saved.flatMap((t) => t.players)])];
  }, [games, leagueGames, saved]);

  const patchTeam = (ti: number, fn: (t: Draft) => Partial<Draft>) =>
    setTeams((ts) => ts.map((t, i) => (i !== ti ? t : { ...t, ...fn(t) })));
  const setPlayer = (ti: number, pi: number, v: string) =>
    patchTeam(ti, (t) => ({ players: t.players.map((p, j) => (j === pi ? v : p)) }));
  const addPlayer = (ti: number) => patchTeam(ti, (t) => ({ players: [...t.players, ""] }));
  const removePlayer = (ti: number, pi: number) =>
    patchTeam(ti, (t) => ({ players: t.players.filter((_, j) => j !== pi) }));

  // Match an existing player's spelling regardless of case.
  const canonical = (n: string) => {
    const c = cleanName(n);
    return known.find((k) => k.toLowerCase() === c.toLowerCase()) ?? c;
  };

  async function start() {
    setError("");
    if (!leagueName) return setError("Enter a league name.");
    if (leagueName.length > 60) return setError("League name is too long.");
    const drafts = teams.map((t) => {
      const typed = cleanName(t.name);
      const match = saved.find((s) => sameName(s.name, typed));
      const players = t.players.map(canonical).filter(Boolean);
      return { name: match?.name ?? typed, players, match, updateSaved: t.updateSaved };
    });
    const cleaned = drafts.map(({ name, players }) => (name ? { name, players } : { players }));
    if (cleaned.some((t) => t.players.length === 0)) return setError("Every team needs at least one player.");
    const all = cleaned.flatMap((t) => t.players.map((p) => p.toLowerCase()));
    if (new Set(all).size !== all.length) return setError("A player is listed twice.");
    const names = drafts.map((t) => t.name.toLowerCase()).filter(Boolean);
    if (new Set(names).size !== names.length) return setError("Two teams have the same name.");
    for (const t of drafts) {
      const problem = t.name && teamProblem(t.name, t.players);
      if (problem) return setError(problem);
    }

    setBusy(true);
    let lg = leagues?.find((l) => l.name.toLowerCase() === leagueName.toLowerCase());
    if (!lg) {
      lg = newLeague(leagueName);
      await saveLeague(lg).catch(() => {}); // a game naming the league still shows it later
    }
    setLastLeague(lg.name);
    // Keep a league filter from hiding the game being started.
    if (getFilter("league")) setFilter("league", lg.name);
    // Remember named teams. A failure here (e.g. offline) must not block the game.
    await Promise.all(
      drafts.map(async (t) => {
        if (!t.name) return;
        if (!t.match) await createTeam(t).catch(() => {});
        else if (t.updateSaved && !samePlayers(t.match.players, t.players))
          await updateTeam(t.match.name, t).catch(() => {});
      }),
    );
    const g = newGame(date, cleaned, lg.name, lg.rules);
    await saveGame(g); // falls back to device storage if offline
    router.push(`/game/${g.id}`);
  }

  return (
    <>
      <h1>New game</h1>

      <div className="card stack">
        <div>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
            <label className="field" htmlFor="league">League</label>
            <Link href="/leagues" className="small">Manage leagues</Link>
          </div>
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
              Uses the standard scoring. Change it any time under <Link href="/leagues">Admin → Leagues</Link>.
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
          onClick={() => setTeams(lastGame.teams.map((t) => ({ name: t.name ?? "", players: [...t.players] })))}
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
          <TeamPicker
            id={`team-${ti}`}
            name={t.name}
            players={t.players}
            saved={saved}
            takenNames={teams.filter((_, i) => i !== ti).map((o) => o.name)}
            updateSaved={!!t.updateSaved}
            onName={(name) => patchTeam(ti, () => ({ name, updateSaved: false }))}
            onPick={(s) => patchTeam(ti, () => ({ name: s.name, players: [...s.players], updateSaved: false }))}
            onUpdateSaved={(updateSaved) => patchTeam(ti, () => ({ updateSaved }))}
          />
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
          {t.players.length < MAX_TEAM_PLAYERS && (
            <button className="btn sm" style={{ marginTop: 10 }} onClick={() => addPlayer(ti)}>
              + Add player
            </button>
          )}
        </div>
      ))}

      {teams.length < 6 && (
        <button className="btn block" onClick={() => setTeams((ts) => [...ts, emptyDraft()])}>
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

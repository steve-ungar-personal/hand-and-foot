"use client";
import { useEffect, useMemo, useState } from "react";
import { FilterName, getFilter, getLastLeague, setFilter, setLastLeague } from "@/lib/client";
import { Game, SavedTeam, leagueOf, samePlayers } from "@/lib/game";

/**
 * A filter choice that is remembered from page to page. Pages show "all" when the choice isn't among
 * their options, without forgetting it.
 */
export function useStickyFilter(name: FilterName) {
  const [value, setValue] = useState<string>();
  useEffect(() => setValue(getFilter(name)), [name]);
  const choose = (v: string) => {
    setValue(v);
    setFilter(name, v);
  };
  return [value, choose] as const;
}

/** League filter state: until one is chosen, this device's last league ("" = all leagues). */
export function useLeagueFilter(games: Game[] | null) {
  const [chosen, setChosen] = useStickyFilter("league");
  const leagues = useMemo(
    () => (games ? [...new Set(games.map(leagueOf))].sort((a, b) => a.localeCompare(b)) : []),
    [games],
  );
  const wanted = chosen ?? (games ? getLastLeague() : null) ?? (leagues.length === 1 ? leagues[0] : "");
  const league = leagues.includes(wanted) ? wanted : "";

  const choose = (l: string) => {
    setChosen(l);
    if (l) setLastLeague(l);
  };
  const filtered = useMemo(
    () => (games && league ? games.filter((g) => leagueOf(g) === league) : games),
    [games, league],
  );
  return { league, leagues, choose, filtered };
}

export default function LeagueFilter({
  league,
  leagues,
  choose,
}: {
  league: string;
  leagues: string[];
  choose: (l: string) => void;
}) {
  if (leagues.length < 2) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <label className="field" htmlFor="league-filter">League</label>
      <select id="league-filter" value={league} onChange={(e) => choose(e.target.value)}>
        <option value="">All leagues</option>
        {leagues.map((l) => (
          <option key={l} value={l}>{l}</option>
        ))}
      </select>
    </div>
  );
}

export function PlayerFilter({
  player,
  setPlayer,
  names,
}: {
  player: string;
  setPlayer: (p: string) => void;
  names: string[];
}) {
  if (names.length === 0) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <label className="field" htmlFor="pf">Player</label>
      <select id="pf" value={player} onChange={(e) => setPlayer(e.target.value)}>
        <option value="">Everyone</option>
        {names.map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
    </div>
  );
}

/** Saved team name(s) for a partnership key ("A & B"), matched by who is on the team. */
export const savedNameOf = (saved: SavedTeam[], partnership: string) =>
  saved
    .filter((s) => samePlayers(s.players, partnership.split(" & ")))
    .map((s) => s.name)
    .join(" / ");

/** Partnerships that count as teams: two or more players, or saved under a team name. */
export const teamChoices = (partnerships: string[], saved: SavedTeam[]) =>
  partnerships.filter((p) => p.includes(" & ") || savedNameOf(saved, p));

export function TeamFilter({
  team,
  setTeam,
  partnerships,
  saved,
}: {
  team: string;
  setTeam: (t: string) => void;
  /** Partnership keys to offer. */
  partnerships: string[];
  saved: SavedTeam[];
}) {
  if (partnerships.length === 0) return null;
  const options = partnerships
    .map((value) => {
      const name = savedNameOf(saved, value);
      return { value, label: name ? `${name} (${value})` : value };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
  return (
    <div style={{ marginBottom: 12 }}>
      <label className="field" htmlFor="team-filter">Team</label>
      <select id="team-filter" value={team} onChange={(e) => setTeam(e.target.value)}>
        <option value="">All teams</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

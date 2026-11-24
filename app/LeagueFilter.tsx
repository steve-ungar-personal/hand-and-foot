"use client";
import { useEffect, useMemo, useState } from "react";
import { getLastLeague, setLastLeague } from "@/lib/client";
import { Game, leagueOf } from "@/lib/game";

/** League filter state: defaults to this device's last league ("" = all leagues). */
export function useLeagueFilter(games: Game[] | null) {
  const [league, setLeague] = useState<string | null>(null);
  const leagues = useMemo(
    () => (games ? [...new Set(games.map(leagueOf))].sort((a, b) => a.localeCompare(b)) : []),
    [games],
  );

  useEffect(() => {
    if (!games || league !== null) return;
    const last = getLastLeague();
    setLeague(last && leagues.includes(last) ? last : leagues.length === 1 ? leagues[0] : "");
  }, [games, leagues, league]);

  const choose = (l: string) => {
    setLeague(l);
    if (l) setLastLeague(l);
  };
  const filtered = games && league ? games.filter((g) => leagueOf(g) === league) : games;
  return { league: league ?? "", leagues, choose, filtered };
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

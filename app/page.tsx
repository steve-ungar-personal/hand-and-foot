"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchGames } from "@/lib/client";
import type { Game } from "@/lib/game";
import { allPlayerNames } from "@/lib/stats";
import GameRow from "./GameRow";
import LeagueFilter, { PlayerFilter, useLeagueFilter, useStickyFilter } from "./LeagueFilter";

export default function Home() {
  const [games, setGames] = useState<Game[] | null>(null);
  const [error, setError] = useState("");
  const [chosenPlayer, setPlayer] = useStickyFilter("player");
  const lf = useLeagueFilter(games);

  useEffect(() => {
    fetchGames()
      .then(setGames)
      .catch((e) => {
        setError(e.message);
        setGames([]);
      });
  }, []);

  const inLeague = lf.filtered ?? [];
  const names = allPlayerNames(inLeague);
  const player = chosenPlayer && names.includes(chosenPlayer) ? chosenPlayer : "";
  const shown = player ? inLeague.filter((g) => g.teams.some((t) => t.players.includes(player))) : inLeague;
  const active = shown.filter((g) => g.status === "active");
  const recent = shown.filter((g) => g.status === "complete").slice(0, 5);

  return (
    <>
      <Link href="/new" className="btn primary block" style={{ margin: "8px 0 16px", minHeight: 56, fontSize: "1.1rem" }}>
        + Start new game
      </Link>
      {error && <div className="banner err">Couldn&apos;t load saved games: {error}</div>}
      {games === null && <p className="muted">Loading…</p>}
      <LeagueFilter {...lf} />
      <PlayerFilter player={player} setPlayer={setPlayer} names={names} />

      {active.length > 0 && (
        <>
          <h2>Resume a game</h2>
          {active.map((g) => (
            <GameRow key={g.id} game={g} />
          ))}
        </>
      )}

      {recent.length > 0 && (
        <>
          <h2>Recent results</h2>
          {recent.map((g) => (
            <GameRow key={g.id} game={g} />
          ))}
          <Link href="/history" className="btn block">All games</Link>
        </>
      )}

      {games !== null && games.length === 0 && !error && (
        <p className="muted">No games yet. Start one above — it saves automatically as you score.</p>
      )}
    </>
  );
}

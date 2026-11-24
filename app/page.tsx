"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchGames } from "@/lib/client";
import type { Game } from "@/lib/game";
import GameRow from "./GameRow";

export default function Home() {
  const [games, setGames] = useState<Game[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchGames()
      .then(setGames)
      .catch((e) => {
        setError(e.message);
        setGames([]);
      });
  }, []);

  const active = games?.filter((g) => g.status === "active") ?? [];
  const recent = games?.filter((g) => g.status === "complete").slice(0, 5) ?? [];

  return (
    <>
      <Link href="/new" className="btn primary block" style={{ margin: "8px 0 16px", minHeight: 56, fontSize: "1.1rem" }}>
        + Start new game
      </Link>
      {error && <div className="banner err">Couldn&apos;t load saved games: {error}</div>}
      {games === null && <p className="muted">Loading…</p>}

      {active.length > 0 && (
        <>
          <h2>Resume a game</h2>
          {active.map((g) => (
            <GameRow key={g.id} game={g} showLeague />
          ))}
        </>
      )}

      {recent.length > 0 && (
        <>
          <h2>Recent results</h2>
          {recent.map((g) => (
            <GameRow key={g.id} game={g} showLeague />
          ))}
          <Link href="/history" className="btn block">All games</Link>
        </>
      )}

      {games !== null && games.length === 0 && !error && (
        <p className="muted">No games yet. Start one above — it saves automatically as you score.</p>
      )}
      <Link href="/leagues" className="btn block" style={{ marginTop: 12 }}>Leagues &amp; scoring rules</Link>
    </>
  );
}

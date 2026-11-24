"use client";
import { useEffect, useState } from "react";
import { fetchGames } from "@/lib/client";
import type { Game } from "@/lib/game";
import { allPlayerNames } from "@/lib/stats";
import GameRow from "../GameRow";
import LeagueFilter, { useLeagueFilter } from "../LeagueFilter";

export default function History() {
  const [games, setGames] = useState<Game[] | null>(null);
  const [error, setError] = useState("");
  const [player, setPlayer] = useState("");
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
  const shown = player ? inLeague.filter((g) => g.teams.some((t) => t.players.includes(player))) : inLeague;

  const exportAll = () => {
    const blob = new Blob([JSON.stringify(games, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `hand-and-foot-games-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <h1>Games</h1>
      {error && <div className="banner err">{error}</div>}
      {games === null && <p className="muted">Loading…</p>}
      <LeagueFilter {...lf} />
      {inLeague.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <label className="field" htmlFor="pf">Player</label>
          <select id="pf" value={player} onChange={(e) => setPlayer(e.target.value)}>
            <option value="">Everyone</option>
            {allPlayerNames(inLeague).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      )}
      {shown.map((g) => (
        <GameRow key={g.id} game={g} showLeague={!lf.league} />
      ))}
      {games && games.length === 0 && !error && <p className="muted">No games saved yet.</p>}
      {games && games.length > 0 && (
        <button className="btn block" style={{ marginTop: 8 }} onClick={exportAll}>
          Download backup (JSON)
        </button>
      )}
    </>
  );
}

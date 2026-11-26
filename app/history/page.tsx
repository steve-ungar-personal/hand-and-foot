"use client";
import { useEffect, useState } from "react";
import { fetchGames, fetchTeams } from "@/lib/client";
import type { Game, SavedTeam } from "@/lib/game";
import { allPlayerNames, partnershipKey } from "@/lib/stats";
import GameRow from "../GameRow";
import LeagueFilter, { PlayerFilter, TeamFilter, teamChoices, useLeagueFilter, useStickyFilter } from "../LeagueFilter";

export default function History() {
  const [games, setGames] = useState<Game[] | null>(null);
  const [error, setError] = useState("");
  const [chosenPlayer, setPlayer] = useStickyFilter("player");
  const [chosenTeam, setTeam] = useStickyFilter("team");
  const [saved, setSaved] = useState<SavedTeam[]>([]);
  const lf = useLeagueFilter(games);

  useEffect(() => {
    fetchTeams().then(setSaved).catch(() => {}); // only used to show team names
    fetchGames()
      .then(setGames)
      .catch((e) => {
        setError(e.message);
        setGames([]);
      });
  }, []);

  const inLeague = lf.filtered ?? [];
  const names = allPlayerNames(inLeague);
  const partnerships = teamChoices([...new Set(inLeague.flatMap((g) => g.teams.map(partnershipKey)))], saved);
  // "" = everyone / all teams, including when the remembered choice isn't in this league.
  const player = chosenPlayer && names.includes(chosenPlayer) ? chosenPlayer : "";
  const selTeam = chosenTeam && partnerships.includes(chosenTeam) ? chosenTeam : "";
  const shown = inLeague.filter(
    (g) =>
      (!player || g.teams.some((t) => t.players.includes(player))) &&
      (!selTeam || g.teams.some((t) => partnershipKey(t) === selTeam)),
  );

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
      <PlayerFilter player={player} setPlayer={setPlayer} names={names} />
      <TeamFilter team={selTeam} setTeam={setTeam} partnerships={partnerships} saved={saved} />
      {inLeague.length > 0 && shown.length === 0 && <p className="muted">No games match these filters.</p>}
      {shown.map((g) => (
        <GameRow key={g.id} game={g} />
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

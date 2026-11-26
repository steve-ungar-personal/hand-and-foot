"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchGames, fetchTeams } from "@/lib/client";
import { Game, SavedTeam, fmt, formatDate } from "@/lib/game";
import { PlayerStats, RecordEntry, computeStats, winPct } from "@/lib/stats";
import LeagueFilter, { TeamFilter, savedNameOf, teamChoices, useLeagueFilter, useStickyFilter } from "../LeagueFilter";

type SortKey = "name" | "games" | "wins" | "losses" | "pct" | "avg";

const pct = (n: number) => `${Math.round(n * 100)}%`;

export default function StatsPage() {
  const [games, setGames] = useState<Game[] | null>(null);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<SortKey>("pct");
  const lf = useLeagueFilter(games);

  const [saved, setSaved] = useState<SavedTeam[]>([]);
  const savedName = (partnership: string) => savedNameOf(saved, partnership);

  useEffect(() => {
    fetchTeams().then(setSaved).catch(() => {});
    fetchGames()
      .then(setGames)
      .catch((e) => {
        setError(e.message);
        setGames([]);
      });
  }, []);

  const [chosenTeam, setTeam] = useStickyFilter("team");
  const overall = useMemo(() => computeStats(lf.filtered ?? []), [lf.filtered]);
  const choices = teamChoices(overall.partnerships.map((t) => t.name), saved);
  // "" = all teams, including when the remembered team has no finished games in this league.
  const selTeam = chosenTeam && choices.includes(chosenTeam) ? chosenTeam : "";
  const stats = useMemo(
    () => (selTeam ? computeStats(lf.filtered ?? [], selTeam) : overall),
    [lf.filtered, overall, selTeam],
  );
  const lineGames = stats.partnerships.reduce((s, t) => s + t.games, 0) || 1;

  const val = (p: PlayerStats, k: SortKey): number | string =>
    k === "name" ? p.name : k === "pct" ? winPct(p) : k === "avg" ? p.points / p.games : p[k];
  const players = [...stats.players].sort((a, b) => {
    const x = val(a, sort);
    const y = val(b, sort);
    if (typeof x === "string") return x.localeCompare(y as string);
    return (y as number) - x || b.games - a.games || a.name.localeCompare(b.name);
  });

  const th = (k: SortKey, label: string) => (
    <th className={`sortable${sort === k ? " sorted" : ""}`} onClick={() => setSort(k)}>
      {label}
    </th>
  );

  const recordRow = (label: string, r?: RecordEntry) =>
    r && (
      <tr key={label}>
        <td>{label}</td>
        <td className="name" style={{ textAlign: "left" }}>
          <Link href={`/game/${r.gameId}`}>{r.label}</Link>
          <div className="small muted">{formatDate(r.date)}</div>
        </td>
        <td>{fmt(r.value)}</td>
      </tr>
    );

  return (
    <>
      <h1>Stats</h1>
      {error && <div className="banner err">{error}</div>}
      {games === null && <p className="muted">Loading…</p>}
      <LeagueFilter {...lf} />
      <TeamFilter
        team={selTeam}
        setTeam={setTeam}
        partnerships={choices}
        saved={saved}
      />

      {games && stats.games === 0 && <p className="muted">Stats appear after the first finished game.</p>}

      {stats.games > 0 && (
        <>
          <p className="muted small">
            {stats.games} finished game{stats.games === 1 ? "" : "s"}. Tap a column to sort, a name for details.
          </p>
          <h2>Players</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {th("name", "Player")}
                  {th("games", "GP")}
                  {th("wins", "W")}
                  {th("losses", "L")}
                  {th("pct", "Win%")}
                  {th("avg", "Avg pts")}
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.name}>
                    <td className="name">
                      <Link href={`/players/${encodeURIComponent(p.name)}`}>{p.name}</Link>
                    </td>
                    <td>{p.games}</td>
                    <td>{p.wins}</td>
                    <td>{p.losses}</td>
                    <td>{pct(winPct(p))}</td>
                    <td>{fmt(Math.round(p.points / p.games))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2>Partnerships</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Team</th>
                  <th>GP</th>
                  <th>W</th>
                  <th>Win%</th>
                  <th>Avg pts</th>
                </tr>
              </thead>
              <tbody>
                {[...stats.partnerships]
                  .sort((a, b) => winPct(b) - winPct(a) || b.games - a.games)
                  .map((t) => (
                    <tr key={t.name}>
                      <td className="name">
                        {savedName(t.name) || t.name}
                        {savedName(t.name) && <div className="small muted">{t.name}</div>}
                      </td>
                      <td>{t.games}</td>
                      <td>{t.wins}</td>
                      <td>{pct(winPct(t))}</td>
                      <td>{fmt(Math.round(t.points / t.games))}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <h2>Records</h2>
          <div className="table-wrap">
            <table>
              <tbody>
                {recordRow("Highest game", stats.records.highGame)}
                {recordRow("Lowest game", stats.records.lowGame)}
                {recordRow("Highest round", stats.records.highRound)}
                {recordRow("Biggest win", stats.records.bigMargin)}
                {recordRow("Closest win", stats.records.closest)}
              </tbody>
            </table>
          </div>

          <h2>Scoring lines</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Line</th>
                  <th>Total</th>
                  <th>Per game</th>
                </tr>
              </thead>
              <tbody>
                {stats.lineDefs.map((l) => (
                  <tr key={l.key}>
                    <td>{l.label}</td>
                    <td>{stats.lineTotals[l.key] ?? 0}</td>
                    <td>{((stats.lineTotals[l.key] ?? 0) / lineGames).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted">
            Per game = per team per game ({lineGames} team-game{lineGames === 1 ? "" : "s"}).
          </p>
        </>
      )}
    </>
  );
}

"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { fetchGames } from "@/lib/client";
import { Game, fmt, formatDate } from "@/lib/game";
import { Record2, computeStats, winPct } from "@/lib/stats";
import LeagueFilter, { useLeagueFilter } from "../../LeagueFilter";

const pct = (n: number) => `${Math.round(n * 100)}%`;

export default function PlayerPage() {
  const name = decodeURIComponent(useParams<{ name: string }>().name);
  const [games, setGames] = useState<Game[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchGames()
      .then((gs) => setGames(gs.filter((g) => g.teams.some((t) => t.players.includes(name)))))
      .catch((e) => {
        setError(e.message);
        setGames([]);
      });
  }, [name]);

  const lf = useLeagueFilter(games);
  const stats = useMemo(() => computeStats(lf.filtered ?? []), [lf.filtered]);
  const p = stats.players.find((x) => x.name === name);

  const recTable = (title: string, recs: Record<string, Record2>) => {
    const rows = Object.entries(recs).sort(([, a], [, b]) => b.games - a.games || winPct(b) - winPct(a));
    if (!rows.length) return null;
    return (
      <>
        <h2>{title}</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>GP</th>
                <th>W</th>
                <th>L</th>
                <th>Win%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([n, r]) => (
                <tr key={n}>
                  <td className="name">
                    <Link href={`/players/${encodeURIComponent(n)}`}>{n}</Link>
                  </td>
                  <td>{r.games}</td>
                  <td>{r.wins}</td>
                  <td>{r.losses}</td>
                  <td>{pct(winPct(r))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  return (
    <>
      <h1>{name}</h1>
      {error && <div className="banner err">{error}</div>}
      {games === null && <p className="muted">Loading…</p>}
      <LeagueFilter {...lf} />
      {games && !p && <p className="muted">No finished games yet.</p>}
      {p && (
        <>
          <div className="tiles">
            <Tile k="Games" v={p.games} />
            <Tile k="Wins" v={p.wins} />
            <Tile k="Losses" v={p.losses} />
            <Tile k="Win %" v={pct(winPct(p))} />
            <Tile k="Avg game" v={fmt(Math.round(p.points / p.games))} />
            <Tile k="Best game" v={fmt(p.best ?? 0)} />
            <Tile k="Worst game" v={fmt(p.worst ?? 0)} />
            <Tile k="Best round" v={fmt(p.bestRound ?? 0)} />
            {p.ties > 0 && <Tile k="Ties" v={p.ties} />}
          </div>

          <h2>Scoring lines</h2>
          <p className="small muted" style={{ marginTop: -4 }}>Counted for the team {name} was on.</p>
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
                    <td>{p.lines[l.key] ?? 0}</td>
                    <td>{((p.lines[l.key] ?? 0) / p.games).toFixed(1)}</td>
                  </tr>
                ))}
                <tr>
                  <td>Card points</td>
                  <td>{fmt(p.cardCount)}</td>
                  <td>{fmt(Math.round(p.cardCount / p.games))}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {recTable("With partners", p.partners)}
          {recTable("Against opponents", p.opponents)}

          <h2>Game log</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Result</th>
                  <th>Score</th>
                  <th>Opp.</th>
                </tr>
              </thead>
              <tbody>
                {p.history.map((h) => (
                  <tr key={h.gameId}>
                    <td>
                      <Link href={`/game/${h.gameId}`}>{formatDate(h.date)}</Link>
                    </td>
                    <td className={`res-${h.result}`}>{h.result.toUpperCase()}</td>
                    <td>{fmt(h.score)}</td>
                    <td>{fmt(h.opp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function Tile({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="tile">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
    </div>
  );
}

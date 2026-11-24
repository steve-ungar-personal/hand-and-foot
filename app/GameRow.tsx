import Link from "next/link";
import { Game, fmt, formatDate, leaders, leagueOf, teamLabel, totals } from "@/lib/game";

export default function GameRow({ game, showLeague }: { game: Game; showLeague?: boolean }) {
  const tot = totals(game);
  const lead = game.status === "complete" ? leaders(game) : [];
  return (
    <Link href={`/game/${game.id}`} className="card link">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
        <span className="small muted">
          {formatDate(game.date)}
          {showLeague && ` · ${leagueOf(game)}`}
        </span>
        {game.status === "active" ? (
          <span className="pill live">
            Round {Math.min(game.currentRound + 1, game.rounds.length)} · in progress
          </span>
        ) : lead.length > 1 ? (
          <span className="pill">Tie</span>
        ) : (
          <span className="pill">Final</span>
        )}
      </div>
      <div className="game-row">
        <div className="teams-list grow">
          {game.teams.map((t, i) => (
            <div key={i} className={`t${lead.length === 1 && lead[0] === i ? " w" : ""}`}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {lead.length === 1 && lead[0] === i ? "🏆 " : ""}
                {teamLabel(t)}
              </span>
              <span className="num">{fmt(tot[i])}</span>
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
}

import { DEFAULT_RULES, Game, LineDef, leaders, roundTotal, rulesOf, teamLabel, totals } from "./game";

export type Result = "win" | "loss" | "tie";

export interface Record2 {
  games: number;
  wins: number;
  losses: number;
  ties: number;
}

export interface PlayerStats extends Record2 {
  name: string;
  points: number;
  best: number | null;
  worst: number | null;
  bestRound: number | null;
  rounds: number;
  /** Total times each line was scored by this player's team. */
  lines: Record<string, number>;
  cardCount: number;
  partners: Record<string, Record2>;
  opponents: Record<string, Record2>;
  history: { gameId: string; date: string; result: Result; score: number; opp: number }[];
}

export interface TeamStats extends Record2 {
  name: string;
  points: number;
  lines: Record<string, number>;
}

export interface RecordEntry {
  value: number;
  label: string;
  gameId: string;
  date: string;
}

export interface Stats {
  games: number;
  players: PlayerStats[];
  partnerships: TeamStats[];
  records: {
    highGame?: RecordEntry;
    lowGame?: RecordEntry;
    highRound?: RecordEntry;
    bigMargin?: RecordEntry;
    closest?: RecordEntry;
  };
  lineTotals: Record<string, number>;
  /** Every scoring line seen (default lines first), for labels and ordering. */
  lineDefs: LineDef[];
}

const emptyLines = (): Record<string, number> => ({});
const add = (m: Record<string, number>, k: string, n: number) => (m[k] = (m[k] ?? 0) + n);
const rec = (): Record2 => ({ games: 0, wins: 0, losses: 0, ties: 0 });
const tally = (r: Record2, res: Result) => {
  r.games++;
  if (res === "win") r.wins++;
  else if (res === "loss") r.losses++;
  else r.ties++;
};

export const winPct = (r: Record2) => (r.games ? (r.wins + r.ties / 2) / r.games : 0);

export function teamResult(g: Game, teamIdx: number): Result {
  const lead = leaders(g);
  if (!lead.includes(teamIdx)) return "loss";
  return lead.length > 1 ? "tie" : "win";
}

export function computeStats(all: Game[]): Stats {
  const games = all.filter((g) => g.status === "complete");
  const players = new Map<string, PlayerStats>();
  const teams = new Map<string, TeamStats>();
  const records: Stats["records"] = {};
  const lineTotals = emptyLines();
  const lineDefs = new Map(DEFAULT_RULES.lines.map((l) => [l.key, l]));

  const better = (cur: RecordEntry | undefined, next: RecordEntry, higher: boolean) =>
    !cur || (higher ? next.value > cur.value : next.value < cur.value) ? next : cur;

  for (const g of games) {
    const rules = rulesOf(g);
    for (const l of rules.lines) if (!lineDefs.has(l.key)) lineDefs.set(l.key, l);
    const tot = totals(g);
    const sorted = [...tot].sort((a, b) => b - a);
    const margin = sorted[0] - sorted[1];

    g.teams.forEach((team, ti) => {
      const res = teamResult(g, ti);
      const score = tot[ti];
      const opp = Math.max(...tot.filter((_, i) => i !== ti));
      const label = teamLabel(team);

      const lines = emptyLines();
      let cards = 0;
      let bestRound: number | null = null;
      g.rounds.forEach((round, ri) => {
        const tr = round[ti];
        for (const [k, n] of Object.entries(tr.counts)) if (n) add(lines, k, n);
        cards += tr.cardCount ?? 0;
        const rt = roundTotal(tr, rules);
        bestRound = bestRound === null ? rt : Math.max(bestRound, rt);
        records.highRound = better(
          records.highRound,
          { value: rt, label: `${label} (round ${ri + 1})`, gameId: g.id, date: g.date },
          true,
        );
      });
      for (const [k, n] of Object.entries(lines)) add(lineTotals, k, n);

      const entry = { value: score, label, gameId: g.id, date: g.date };
      records.highGame = better(records.highGame, entry, true);
      records.lowGame = better(records.lowGame, entry, false);

      const key = [...team.players].sort((a, b) => a.localeCompare(b)).join(" & ");
      const ts = teams.get(key) ?? { name: key, points: 0, lines: emptyLines(), ...rec() };
      for (const [k, n] of Object.entries(lines)) add(ts.lines, k, n);
      tally(ts, res);
      ts.points += score;
      teams.set(key, ts);

      for (const p of team.players) {
        const ps =
          players.get(p) ??
          ({
            name: p,
            points: 0,
            best: null,
            worst: null,
            bestRound: null,
            rounds: 0,
            lines: emptyLines(),
            cardCount: 0,
            partners: {},
            opponents: {},
            history: [],
            ...rec(),
          } as PlayerStats);
        tally(ps, res);
        ps.points += score;
        ps.best = ps.best === null ? score : Math.max(ps.best, score);
        ps.worst = ps.worst === null ? score : Math.min(ps.worst, score);
        if (bestRound !== null) ps.bestRound = ps.bestRound === null ? bestRound : Math.max(ps.bestRound, bestRound);
        ps.rounds += g.rounds.length;
        ps.cardCount += cards;
        for (const [k, n] of Object.entries(lines)) add(ps.lines, k, n);
        for (const mate of team.players) if (mate !== p) tally((ps.partners[mate] ??= rec()), res);
        g.teams.forEach((other, oi) => {
          if (oi !== ti) for (const o of other.players) tally((ps.opponents[o] ??= rec()), res);
        });
        ps.history.push({ gameId: g.id, date: g.date, result: res, score, opp });
        players.set(p, ps);
      }
    });

    if (margin > 0) {
      const w = g.teams[tot.indexOf(sorted[0])];
      const m = { value: margin, label: teamLabel(w), gameId: g.id, date: g.date };
      records.bigMargin = better(records.bigMargin, m, true);
      records.closest = better(records.closest, m, false);
    }
  }

  return {
    games: games.length,
    players: [...players.values()],
    partnerships: [...teams.values()],
    records,
    lineTotals,
    lineDefs: [...lineDefs.values()],
  };
}

export function allPlayerNames(games: Game[]): string[] {
  const names = new Set<string>();
  for (const g of games) for (const t of g.teams) for (const p of t.players) names.add(p);
  return [...names].sort((a, b) => a.localeCompare(b));
}

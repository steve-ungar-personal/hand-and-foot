// Scoring rules and game model for Hand and Foot.

export interface LineDef {
  key: string;
  label: string;
  value: number;
  /** "toggle" lines are yes/no and only one team per round can have them (going out). */
  kind: "count" | "toggle";
  /** Perfect cut is scored at the start of the hand, everything else at the end. */
  phase: "start" | "end";
  /** Scored automatically: 1 when the listed lines add up to at least `atLeast`. */
  auto?: { sumOf: string[]; atLeast: number };
}

export interface CardDef {
  key: string;
  label: string;
  value: number;
}

export interface Rules {
  lines: LineDef[];
  /** Card values for the card-count calculator. */
  cards?: CardDef[];
  /** Minimum points to lay down, one entry per round. */
  rounds: { min: number }[];
}

export const DEFAULT_CARDS: CardDef[] = [
  { key: "joker", label: "Jokers", value: 50 },
  { key: "aceTwo", label: "Aces & 2s", value: 20 },
  { key: "high", label: "K, Q, J, 10, 9, 8", value: 10 },
  { key: "low", label: "7, 6, 5, 4", value: 5 },
  { key: "black3", label: "Black 3s", value: -100 },
  { key: "red3Plus", label: "Red 3s (+)", value: 100 },
  { key: "red3Minus", label: "Red 3s (−)", value: -100 },
];

const TEN_BOOKS_AUTO = { sumOf: ["cleanBook", "dirtyBook"], atLeast: 10 };

export const DEFAULT_RULES: Rules = {
  lines: [
    { key: "perfectCut", label: "Perfect cut", value: 100, kind: "count", phase: "start" },
    { key: "goingOut", label: "Going out", value: 1000, kind: "toggle", phase: "end" },
    { key: "cleanBook", label: "Clean book", value: 500, kind: "count", phase: "end" },
    { key: "dirtyBook", label: "Dirty book", value: 300, kind: "count", phase: "end" },
    { key: "tenBooks", label: "10 or more books", value: 1000, kind: "count", phase: "end", auto: TEN_BOOKS_AUTO },
    { key: "pureWild", label: "Pure wild cards", value: 3000, kind: "count", phase: "end" },
    { key: "mixedWild", label: "Mixed wild cards", value: 2000, kind: "count", phase: "end" },
    { key: "someWild", label: "Some wild cards", value: -2000, kind: "count", phase: "end" },
  ],
  rounds: [{ min: 50 }, { min: 90 }, { min: 120 }, { min: 150 }],
  cards: DEFAULT_CARDS,
};

export const CARD_VALUES = "Joker 50 · A & 2 20 · K–8 10 · 7–4 5 · Black 3 −100 · Red 3 ±100";

export interface League {
  name: string;
  rules: Rules;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_LEAGUE = "General";

export interface TeamRound {
  counts: Record<string, number>;
  /** Card count incl. red 3s; may be negative. null = not entered yet. */
  cardCount: number | null;
  /** Optional card-by-card tally used to calculate cardCount. */
  cards?: Record<string, number>;
}

export interface Team {
  players: string[];
  name?: string;
}

export interface Game {
  id: string;
  league?: string;
  /** Snapshot of the league's rules when the game started. */
  rules?: Rules;
  /** Date played, YYYY-MM-DD (local). */
  date: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  status: "active" | "complete";
  teams: Team[];
  /** rounds[roundIndex][teamIndex] */
  rounds: TeamRound[][];
  currentRound: number;
}

export const rulesOf = (g: Game) => g.rules ?? DEFAULT_RULES;
export const cardsOf = (r: Rules) => r.cards ?? DEFAULT_CARDS;

/** Card count from a card-by-card tally; null when nothing has been entered. */
export function cardTally(tally: Record<string, number> | undefined, cards: CardDef[]): number | null {
  if (!tally || !Object.values(tally).some((n) => n)) return null;
  return cards.reduce((sum, c) => sum + (tally[c.key] ?? 0) * c.value, 0);
}
export const leagueOf = (g: Game) => g.league?.trim() || DEFAULT_LEAGUE;

/** Auto rule for a line (older saved rules get the 10-books rule by key). */
export const autoOf = (l: LineDef) => l.auto ?? (l.key === "tenBooks" ? TEN_BOOKS_AUTO : undefined);

/** Recomputes automatically-scored lines (e.g. 10 or more books) from the other counts. */
export function applyAuto(tr: TeamRound, rules: Rules) {
  for (const l of rules.lines) {
    const a = autoOf(l);
    if (!a) continue;
    const sum = a.sumOf.reduce((s, k) => s + (tr.counts[k] ?? 0), 0);
    if (sum >= a.atLeast) tr.counts[l.key] = 1;
    else delete tr.counts[l.key];
  }
}

export const emptyTeamRound = (): TeamRound => ({ counts: {}, cardCount: null });

/** crypto.randomUUID only exists on HTTPS/localhost; fall back for plain-http LAN testing. */
export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function newGame(date: string, teams: Team[], league: string, rules: Rules): Game {
  const now = new Date().toISOString();
  return {
    id: newId(),
    league,
    rules: structuredClone(rules),
    date,
    createdAt: now,
    updatedAt: now,
    status: "active",
    teams,
    rounds: rules.rounds.map(() => teams.map(emptyTeamRound)),
    currentRound: 0,
  };
}

export const newLeague = (name: string, rules: Rules = DEFAULT_RULES): League => {
  const now = new Date().toISOString();
  return { name, rules: structuredClone(rules), createdAt: now, updatedAt: now };
};

export const teamLabel = (t: Team) => t.name?.trim() || t.players.join(" & ");

export const linePoints = (tr: TeamRound, def: LineDef) => (tr.counts[def.key] ?? 0) * def.value;

export const roundTotal = (tr: TeamRound, rules: Rules) =>
  rules.lines.reduce((sum, d) => sum + linePoints(tr, d), 0) + (tr.cardCount ?? 0);

export const roundHasData = (tr: TeamRound) =>
  tr.cardCount !== null || Object.values(tr.counts).some((v) => !!v);

/** Cumulative total for a team through (and including) the given round index. */
export function cumulative(g: Game, teamIdx: number, throughRound = g.rounds.length - 1) {
  const rules = rulesOf(g);
  let sum = 0;
  for (let r = 0; r <= throughRound; r++) sum += roundTotal(g.rounds[r][teamIdx], rules);
  return sum;
}

export const totals = (g: Game) => g.teams.map((_, i) => cumulative(g, i));

/** Indices of the team(s) with the highest total (more than one = tie). */
export function leaders(g: Game): number[] {
  const t = totals(g);
  const max = Math.max(...t);
  return t.flatMap((v, i) => (v === max ? [i] : []));
}

export const fmt = (n: number) => (n === 0 ? "0" : n.toLocaleString("en-US"));

export function todayLocal() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const cleanName = (s: string) => s.trim().replace(/\s+/g, " ");

const isNum = (n: unknown) => typeof n === "number" && Number.isFinite(n);

export function isRules(x: unknown): x is Rules {
  const r = x as Rules;
  return (
    !!r &&
    Array.isArray(r.lines) &&
    r.lines.length <= 30 &&
    r.lines.every(
      (l) =>
        typeof l.key === "string" &&
        typeof l.label === "string" &&
        isNum(l.value) &&
        (l.kind === "count" || l.kind === "toggle") &&
        (l.phase === "start" || l.phase === "end"),
    ) &&
    Array.isArray(r.rounds) &&
    r.rounds.length >= 1 &&
    r.rounds.length <= 10 &&
    r.rounds.every((x) => isNum(x.min)) &&
    (r.cards === undefined ||
      (Array.isArray(r.cards) &&
        r.cards.length <= 20 &&
        r.cards.every((c) => typeof c.key === "string" && typeof c.label === "string" && isNum(c.value))))
  );
}

export function isLeague(x: unknown): x is League {
  const l = x as League;
  return !!l && typeof l.name === "string" && l.name.trim().length > 0 && l.name.length <= 60 && isRules(l.rules);
}

/** Basic shape check for data coming into the API. */
export function isGame(x: unknown): x is Game {
  const g = x as Game;
  return (
    !!g &&
    typeof g.id === "string" &&
    g.id.length > 0 &&
    g.id.length <= 64 &&
    (g.league === undefined || (typeof g.league === "string" && g.league.length <= 60)) &&
    (g.rules === undefined || isRules(g.rules)) &&
    typeof g.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(g.date) &&
    (g.status === "active" || g.status === "complete") &&
    Array.isArray(g.teams) &&
    g.teams.length >= 2 &&
    g.teams.length <= 8 &&
    g.teams.every((t) => Array.isArray(t.players) && t.players.every((p) => typeof p === "string")) &&
    Array.isArray(g.rounds) &&
    g.rounds.length === rulesOf(g).rounds.length &&
    g.rounds.every((r) => Array.isArray(r) && r.length === g.teams.length)
  );
}

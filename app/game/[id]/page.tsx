"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { deleteGame, loadGame, saveGame, setLastLeague } from "@/lib/client";
import {
  CARD_VALUES,
  applyAuto,
  autoOf,
  Game,
  LineDef,
  TeamRound,
  cumulative,
  fmt,
  formatDate,
  leaders,
  leagueOf,
  linePoints,
  newGame,
  roundHasData,
  roundTotal,
  rulesOf,
  teamLabel,
  todayLocal,
  totals,
} from "@/lib/game";

type SaveState = "saved" | "saving" | "offline";

export default function GamePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [game, setGame] = useState<Game | null>(null);
  const [missing, setMissing] = useState(false);
  const [view, setView] = useState<number | "sheet">(0);
  const [team, setTeam] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [notice, setNotice] = useState("");
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<Game | null>(null);

  useEffect(() => {
    loadGame(id).then(({ game, offline }) => {
      if (!game) return setMissing(true);
      setGame(game);
      setLastLeague(leagueOf(game));
      setView(game.status === "complete" ? "sheet" : game.currentRound);
      if (offline) setSaveState("offline");
    });
  }, [id]);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!latest.current) return;
    setSaveState("saving");
    setSaveState((await saveGame(latest.current)) ? "saved" : "offline");
  }, []);

  // Auto-save shortly after every change.
  useEffect(() => {
    if (!game || !dirty.current) return;
    latest.current = game;
    setSaveState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 600);
  }, [game, flush]);

  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && timer.current && flush();
    const onOnline = () => latest.current && flush();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("online", onOnline);
    };
  }, [flush]);

  const update = (fn: (g: Game) => void) => {
    dirty.current = true;
    setGame((g) => {
      if (!g) return g;
      const next = structuredClone(g);
      fn(next);
      next.updatedAt = new Date().toISOString();
      return next;
    });
  };

  if (missing)
    return (
      <div className="banner err">
        Game not found. <Link href="/">Go home</Link>
      </div>
    );
  if (!game) return <p className="muted">Loading…</p>;

  const rules = rulesOf(game);
  const nRounds = game.rounds.length;
  const tot = totals(game);
  const round = view === "sheet" ? null : view;

  const setRoundTeam = (fn: (tr: TeamRound, g: Game) => void) =>
    update((g) => fn(g.rounds[round!][team], g));

  const goRound = (r: number) => {
    setView(r);
    setTeam(0);
    if (r > game.currentRound) update((g) => void (g.currentRound = r));
    window.scrollTo({ top: 0 });
  };

  /** Applies a change and saves it right away (no debounce). */
  const commitNow = async (fn: (g: Game) => void) => {
    const next = structuredClone(game);
    fn(next);
    next.updatedAt = new Date().toISOString();
    dirty.current = false; // skip the debounced save; we save here
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    latest.current = next;
    setGame(next);
    setSaveState("saving");
    const ok = await saveGame(next);
    setSaveState(ok ? "saved" : "offline");
    return ok;
  };

  const saveFinished = async () => {
    setView("sheet");
    window.scrollTo({ top: 0 });
    const ok = await commitNow((g) => {
      g.status = "complete";
      g.completedAt = new Date().toISOString();
    });
    setNotice(ok ? "✓ Game saved" : "Saved on this device — will upload when back online");
  };

  const saveAndExit = async () => {
    await commitNow(() => {});
    router.push("/");
  };

  const rematch = async () => {
    const g = newGame(
      todayLocal(),
      game.teams.map((t) => ({ players: [...t.players] })),
      leagueOf(game),
      rules,
    );
    await saveGame(g);
    router.push(`/game/${g.id}`);
  };

  const remove = async () => {
    const what = game.status === "active" ? "this game in progress" : "this game";
    if (!confirm(`Delete ${what} permanently? This cannot be undone.`)) return;
    try {
      await deleteGame(game.id);
      router.push("/");
    } catch (e) {
      alert(`Could not delete: ${(e as Error).message}`);
    }
  };

  return (
    <>
      <div className="score-head">
        <div className="row small muted" style={{ margin: "0 2px 6px", justifyContent: "space-between" }}>
          <span>
            {leagueOf(game)} · {formatDate(game.date)}
          </span>
          {game.status === "active" && (
            <button className="link-btn danger" onClick={remove}>Delete game</button>
          )}
        </div>
        <div className="tabs" role="tablist">
          {game.rounds.map((r, i) => (
            <button key={i} className={view === i ? "on" : ""} onClick={() => goRound(i)}>
              R{i + 1}
              {r.some(roundHasData) && <span className="dot" />}
            </button>
          ))}
          <button className={view === "sheet" ? "on" : ""} onClick={() => setView("sheet")}>
            Sheet
          </button>
        </div>
        {round !== null && (
          <div className="teams" style={{ gridTemplateColumns: `repeat(${game.teams.length}, minmax(0, 1fr))` }}>
            {game.teams.map((t, i) => (
              <button key={i} className={`team-chip${team === i ? " on" : ""}`} onClick={() => setTeam(i)}>
                <div className="nm">{teamLabel(t)}</div>
                <div className={`rt${roundTotal(game.rounds[round][i], rules) < 0 ? " neg" : ""}`}>
                  {fmt(roundTotal(game.rounds[round][i], rules))}
                </div>
                <div className="ct">Total {fmt(cumulative(game, i, round))}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {round !== null ? (
        <RoundEntry
          key={`${round}-${team}`}
          game={game}
          round={round}
          team={team}
          onChange={setRoundTeam}
        />
      ) : (
        <>
          {notice && <div className="banner">{notice}</div>}
          <Sheet game={game} onDate={(d) => update((g) => void (g.date = d))} />
        </>
      )}

      {view === "sheet" && (
        <div className="stack" style={{ marginTop: 16 }}>
          {game.status === "complete" ? (
            <>
              <button className="btn block" onClick={() => router.push("/")}>Done</button>
              <button className="btn primary block" onClick={rematch}>↻ Rematch (same teams)</button>
              <button
                className="btn block"
                onClick={() => {
                  setNotice("");
                  update((g) => void (g.status = "active"));
                }}
              >
                Reopen to edit scores
              </button>
            </>
          ) : (
            <>
              <button className="btn primary block" onClick={saveFinished}>Save game (final)</button>
              <button className="btn block" onClick={saveAndExit}>Save &amp; continue later</button>
            </>
          )}
          <button className="btn danger block" onClick={remove}>Delete game</button>
        </div>
      )}

      {round !== null && (
        <div className="footer-bar">
          <div className="inner">
            <button
              className="btn"
              disabled={round === 0 && team === 0}
              onClick={() => (team > 0 ? setTeam(team - 1) : goRound(round - 1))}
              aria-label="Back"
            >
              ←
            </button>
            {team < game.teams.length - 1 ? (
              <button className="btn primary grow" onClick={() => setTeam(team + 1)}>
                Next: {teamLabel(game.teams[team + 1])} →
              </button>
            ) : round < nRounds - 1 ? (
              <button className="btn primary grow" onClick={() => goRound(round + 1)}>
                Round {round + 2} →
              </button>
            ) : game.status === "complete" ? (
              <button className="btn primary grow" onClick={() => setView("sheet")}>View sheet</button>
            ) : (
              <button className="btn primary grow" onClick={saveFinished}>Save game</button>
            )}
          </div>
          <div className="save-state">
            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "✓ Saved" : "Offline — saved on this device, will sync"}
            {" · "}Leader: {teamLabel(game.teams[tot.indexOf(Math.max(...tot))])}
          </div>
        </div>
      )}
    </>
  );
}

function RoundEntry({
  game,
  round,
  team,
  onChange,
}: {
  game: Game;
  round: number;
  team: number;
  onChange: (fn: (tr: TeamRound, g: Game) => void) => void;
}) {
  const rules = rulesOf(game);
  const tr = game.rounds[round][team];
  const start = rules.lines.filter((l) => l.phase === "start");
  const end = rules.lines.filter((l) => l.phase === "end");
  const total = roundTotal(tr, rules);

  const setCount = (key: string, n: number) =>
    onChange((t, g) => {
      if (n > 0) t.counts[key] = n;
      else delete t.counts[key];
      applyAuto(t, rulesOf(g));
    });

  const toggle = (def: LineDef) =>
    onChange((t, g) => {
      const on = !t.counts[def.key];
      // Only one team per round can go out.
      g.rounds[round].forEach((other) => delete other.counts[def.key]);
      if (on) t.counts[def.key] = 1;
    });

  const row = (def: LineDef) => {
    const n = tr.counts[def.key] ?? 0;
    const pts = linePoints(tr, def);
    const holder =
      def.kind === "toggle" ? game.rounds[round].findIndex((o, i) => i !== team && o.counts[def.key]) : -1;
    const auto = autoOf(def);
    const autoSum = auto ? auto.sumOf.reduce((s, k) => s + (tr.counts[k] ?? 0), 0) : 0;
    return (
      <div className="line" key={def.key}>
        <div className="line-label">
          <div className="l">{def.label}</div>
          <div className="v">
            {def.kind === "toggle"
              ? holder >= 0
                ? `${teamLabel(game.teams[holder])} went out`
                : `${fmt(def.value)} pts`
              : auto
                ? `Automatic · ${autoSum} of ${auto.atLeast} books`
                : `${fmt(def.value)} each`}
          </div>
        </div>
        {auto ? (
          <span className={`auto-badge${n ? " on" : ""}`}>{n ? "✓ Yes" : "Not yet"}</span>
        ) : def.kind === "toggle" ? (
          <button className={`toggle${n ? " on" : ""}`} onClick={() => toggle(def)} aria-pressed={!!n}>
            {n ? "✓ Went out" : "No"}
          </button>
        ) : (
          <div className="stepper">
            <button onClick={() => setCount(def.key, n - 1)} disabled={n === 0} aria-label={`Fewer ${def.label}`}>
              −
            </button>
            <span className="n">{n}</span>
            <button onClick={() => setCount(def.key, n + 1)} aria-label={`More ${def.label}`}>
              +
            </button>
          </div>
        )}
        <div className={`line-pts${pts === 0 ? " zero" : pts < 0 ? " neg" : ""}`}>{fmt(pts)}</div>
      </div>
    );
  };

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", margin: "4px 4px 0" }}>
        <strong>Round {round + 1}</strong>
        <span className="small muted">{rules.rounds[round].min} min to lay down</span>
      </div>

      {start.length > 0 && (
        <>
          <div className="section-title">Start of hand</div>
          <div className="lines">{start.map(row)}</div>
        </>
      )}

      <div className="section-title">End of hand</div>
      <div className="lines">
        {end.map(row)}
        <div className="line">
          <div className="line-label">
            <div className="l">Card count</div>
            <div className="v">incl. red 3s</div>
          </div>
          <CardCount value={tr.cardCount} onChange={(v) => onChange((t) => void (t.cardCount = v))} />
        </div>
      </div>
      <p className="small muted" style={{ margin: "6px 4px" }}>{CARD_VALUES}</p>

      <div className="total-bar">
        <span>
          <strong>{teamLabel(game.teams[team])}</strong>
          <br />
          <span className="small muted">Round {round + 1} total</span>
        </span>
        <span className={`big${total < 0 ? " neg" : ""}`}>{fmt(total)}</span>
      </div>
    </>
  );
}

function CardCount({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const [text, setText] = useState(value === null ? "" : String(value));

  const commit = (t: string) => {
    if (!/^-?\d*$/.test(t)) return;
    setText(t);
    onChange(t === "" || t === "-" ? null : parseInt(t, 10));
  };

  return (
    <div className="cc">
      <button
        className="icon-btn sign"
        aria-label="Make negative or positive"
        onClick={() => commit(text.startsWith("-") ? text.slice(1) : `-${text}`)}
      >
        ±
      </button>
      <input
        type="text"
        inputMode="numeric"
        enterKeyHint="done"
        placeholder="0"
        value={text}
        onChange={(e) => commit(e.target.value.replace(/[^\d-]/g, ""))}
        onFocus={(e) => e.target.select()}
        aria-label="Card count"
        className={value !== null && value < 0 ? "neg" : ""}
      />
    </div>
  );
}

function Sheet({ game, onDate }: { game: Game; onDate: (d: string) => void }) {
  const rules = rulesOf(game);
  const tot = totals(game);
  const lead = leaders(game);
  const done = game.status === "complete";
  const cols = game.teams.length;
  const cell = (tr: TeamRound, def: LineDef) => {
    const n = tr.counts[def.key] ?? 0;
    if (!n) return "";
    const pts = fmt(linePoints(tr, def));
    return def.kind === "toggle" ? pts : `×${n} = ${pts}`;
  };

  return (
    <>
      {done && (
        <div className="banner win">
          {lead.length > 1
            ? `🤝 Tie: ${lead.map((i) => teamLabel(game.teams[i])).join(" & ")} at ${fmt(tot[lead[0]])}`
            : `🏆 ${teamLabel(game.teams[lead[0]])} wins by ${fmt(
                tot[lead[0]] - Math.max(...tot.filter((_, i) => i !== lead[0])),
              )}`}
        </div>
      )}
      <div className="card row">
        <label className="field grow" htmlFor="gdate" style={{ margin: 0 }}>Date played</label>
        <input id="gdate" type="date" style={{ width: "auto" }} value={game.date} onChange={(e) => e.target.value && onDate(e.target.value)} />
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th></th>
              {game.teams.map((t, i) => (
                <th key={i} style={{ whiteSpace: "normal" }}>{teamLabel(t)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {game.rounds.map((r, ri) => {
              const used = rules.lines.filter((l) => r.some((tr) => tr.counts[l.key]));
              return (
                <Fragment key={ri}>
                  <tr className="hdr">
                    <td colSpan={cols + 1}>
                      Round {ri + 1} <span className="small muted">· {rules.rounds[ri].min} min</span>
                    </td>
                  </tr>
                  {used.map((l) => (
                    <tr key={l.key}>
                      <td>{l.label}</td>
                      {r.map((tr, ti) => (
                        <td key={ti} className={linePoints(tr, l) < 0 ? "neg" : ""}>{cell(tr, l)}</td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <td>Card count</td>
                    {r.map((tr, ti) => (
                      <td key={ti} className={(tr.cardCount ?? 0) < 0 ? "neg" : ""}>
                        {tr.cardCount === null ? "" : fmt(tr.cardCount)}
                      </td>
                    ))}
                  </tr>
                  <tr className="sub">
                    <td>Round {ri + 1} total</td>
                    {r.map((tr, ti) => (
                      <td key={ti}>{fmt(roundTotal(tr, rules))}</td>
                    ))}
                  </tr>
                  {ri > 0 && (
                    <tr>
                      <td>Cumulative</td>
                      {r.map((_, ti) => (
                        <td key={ti}>{fmt(cumulative(game, ti, ri))}</td>
                      ))}
                    </tr>
                  )}
                </Fragment>
              );
            })}
            <tr className="win-row">
              <td>Final total</td>
              {tot.map((v, i) => (
                <td key={i}>{(done && lead.includes(i) ? "🏆 " : "") + fmt(v)}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

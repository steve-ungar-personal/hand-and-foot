"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { deleteGame, loadGame, saveGame, setLastLeague } from "@/lib/client";
import {
  applyAuto,
  cardTally,
  cardsOf,
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

  const setRoundTeam = (team: number, fn: (tr: TeamRound, g: Game) => void) =>
    update((g) => fn(g.rounds[round!][team], g));

  const goRound = (r: number) => {
    setView(r);
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
          <div
            className={`teams entry-head${game.teams.length > 2 ? " many" : ""}`}
            style={{ gridTemplateColumns: `repeat(${game.teams.length}, minmax(0, 1fr))` }}
          >
            {game.teams.map((t, i) => {
              const rt = roundTotal(game.rounds[round][i], rules);
              return (
                <div key={i} className="team-chip">
                  <div className="nm">{teamLabel(t)}</div>
                  <div className={`rt${rt < 0 ? " neg" : ""}`}>{fmt(rt)}</div>
                  <div className="ct">Total {fmt(cumulative(game, i, round))}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {round !== null ? (
        <RoundEntry key={round} game={game} round={round} onChange={setRoundTeam} />
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
              disabled={round === 0}
              onClick={() => goRound(round - 1)}
              aria-label="Previous round"
            >
              {round > 0 ? `← R${round}` : "←"}
            </button>
            {round < nRounds - 1 ? (
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
  onChange,
}: {
  game: Game;
  round: number;
  onChange: (team: number, fn: (tr: TeamRound, g: Game) => void) => void;
}) {
  const rules = rulesOf(game);
  const cards = cardsOf(rules);
  const trs = game.rounds[round];
  const cols = { gridTemplateColumns: `repeat(${game.teams.length}, minmax(0, 1fr))` };
  const start = rules.lines.filter((l) => l.phase === "start");
  const end = rules.lines.filter((l) => l.phase === "end");
  const lc = `lines entry${game.teams.length > 2 ? " many" : ""}`;

  const setCount = (team: number, key: string, n: number) =>
    onChange(team, (t, g) => {
      if (n > 0) t.counts[key] = n;
      else delete t.counts[key];
      applyAuto(t, rulesOf(g));
    });

  const toggle = (team: number, def: LineDef) =>
    onChange(team, (t, g) => {
      const on = !t.counts[def.key];
      // Only one team per round can go out.
      g.rounds[round].forEach((other) => delete other.counts[def.key]);
      if (on) t.counts[def.key] = 1;
    });

  const setTally = (team: number, key: string, n: number) =>
    onChange(team, (t, g) => {
      t.cards = { ...(t.cards ?? {}) };
      if (n > 0) t.cards[key] = n;
      else delete t.cards[key];
      t.cardCount = cardTally(t.cards, cardsOf(rulesOf(g)));
    });

  const cell = (def: LineDef, ti: number) => {
    const tr = trs[ti];
    const n = tr.counts[def.key] ?? 0;
    const pts = linePoints(tr, def);
    const auto = autoOf(def);
    const label = teamLabel(game.teams[ti]);
    let control;
    if (auto) {
      const sum = auto.sumOf.reduce((s, k) => s + (tr.counts[k] ?? 0), 0);
      control = (
        <span className={`auto-badge${n ? " on" : ""}`} title={`${sum} of ${auto.atLeast} books`}>
          {n ? "✓ Yes" : `${sum}/${auto.atLeast}`}
        </span>
      );
    } else if (def.kind === "toggle") {
      control = (
        <button
          className={`toggle${n ? " on" : ""}`}
          onClick={() => toggle(ti, def)}
          aria-pressed={!!n}
          aria-label={`${label}: ${def.label}`}
        >
          {n ? "✓ Out" : "No"}
        </button>
      );
    } else {
      control = (
        <div className="stepper">
          <button
            onClick={() => setCount(ti, def.key, n - 1)}
            disabled={n === 0}
            aria-label={`${label}: fewer ${def.label}`}
          >
            −
          </button>
          <span className="n">{n}</span>
          <button onClick={() => setCount(ti, def.key, n + 1)} aria-label={`${label}: more ${def.label}`}>
            +
          </button>
        </div>
      );
    }
    return (
      <div className="mcell" key={ti}>
        {control}
        <div className={`mpts${pts === 0 ? " zero" : pts < 0 ? " neg" : ""}`}>{fmt(pts)}</div>
      </div>
    );
  };

  const line = (def: LineDef) => {
    const auto = autoOf(def);
    return (
      <div className="mline" key={def.key}>
        <div className="mline-label">
          <span className="l">{def.label}</span>
          <span className="v">
            {auto
              ? `auto at ${auto.atLeast}+`
              : def.kind === "toggle"
                ? fmt(def.value)
                : `${fmt(def.value)} each`}
          </span>
        </div>
        <div className="mcells" style={cols}>
          {game.teams.map((_, ti) => cell(def, ti))}
        </div>
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
          <div className={lc}>{start.map(line)}</div>
        </>
      )}

      <div className="section-title">End of hand</div>
      <div className={lc}>
        {end.map(line)}
        <div className="mline">
          <div className="mline-label">
            <span className="l">Card count</span>
            <span className="v">incl. red 3s</span>
          </div>
          <div className="mcells" style={cols}>
            {trs.map((tr, ti) => (
              <div className="mcell" key={ti}>
                <CardCount
                  value={tr.cardCount}
                  label={teamLabel(game.teams[ti])}
                  onChange={(v) => onChange(ti, (t) => void (t.cardCount = v))}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="mline total">
          <div className="mline-label">
            <span className="l">Round {round + 1} total</span>
          </div>
          <div className="mcells" style={cols}>
            {trs.map((tr, ti) => {
              const t = roundTotal(tr, rules);
              return (
                <div className={`mcell big${t < 0 ? " neg" : ""}`} key={ti}>
                  {fmt(t)}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <details className="calc">
        <summary>Card count calculator</summary>
        <p className="small muted" style={{ margin: "0 4px 8px" }}>
          Enter how many of each card the team has. The total fills in the card count above.
        </p>
        <div className={lc}>
          {cards.map((c) => (
            <div className="mline" key={c.key}>
              <div className="mline-label">
                <span className="l">{c.label}</span>
                <span className="v">{c.value > 0 ? `+${c.value}` : fmt(c.value)} each</span>
              </div>
              <div className="mcells" style={cols}>
                {trs.map((tr, ti) => (
                  <div className="mcell" key={ti}>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="tally"
                      placeholder="0"
                      aria-label={`${teamLabel(game.teams[ti])}: number of ${c.label}`}
                      value={tr.cards?.[c.key] ? String(tr.cards[c.key]) : ""}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) =>
                        setTally(ti, c.key, parseInt(e.target.value.replace(/\D/g, "") || "0", 10))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="mline total">
            <div className="mline-label">
              <span className="l">Card count</span>
            </div>
            <div className="mcells" style={cols}>
              {trs.map((tr, ti) => {
                const v = cardTally(tr.cards, cards);
                return (
                  <div className={`mcell big${(v ?? 0) < 0 ? " neg" : ""}`} key={ti}>
                    {v === null ? "–" : fmt(v)}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </details>
    </>
  );
}

function CardCount({
  value,
  label,
  onChange,
}: {
  value: number | null;
  label: string;
  onChange: (v: number | null) => void;
}) {
  const [text, setText] = useState(value === null ? "" : String(value));

  // Follow changes made elsewhere (e.g. the calculator).
  useEffect(() => {
    const cur = text === "" || text === "-" ? null : parseInt(text, 10);
    if (cur !== value) setText(value === null ? "" : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const commit = (t: string) => {
    if (!/^-?\d*$/.test(t)) return;
    setText(t);
    onChange(t === "" || t === "-" ? null : parseInt(t, 10));
  };

  return (
    <div className="cc">
      <button
        className="sign"
        aria-label={`${label}: make card count negative or positive`}
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
        aria-label={`${label}: card count`}
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

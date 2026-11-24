"use client";
import { useEffect, useState } from "react";
import { deleteLeague, fetchGames, fetchLeagues, renameLeague, saveLeague } from "@/lib/client";
import { DEFAULT_RULES, Game, autoOf, League, Rules, cleanName, leagueOf, newLeague } from "@/lib/game";

type Panel = { name: string; mode: "scoring" | "rename" } | null;

export default function LeaguesPage() {
  const [leagues, setLeagues] = useState<League[] | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [panel, setPanel] = useState<Panel>(null);
  const [name, setName] = useState("");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const gs = await fetchGames().catch(() => [] as Game[]);
    setGames(gs);
    setLeagues(await fetchLeagues(gs));
  };

  useEffect(() => {
    load();
  }, []);

  const count = (league: string) => games.filter((g) => leagueOf(g) === league).length;
  const toggle = (league: string, mode: "scoring" | "rename") => {
    setError("");
    if (panel?.name === league && panel.mode === mode) return setPanel(null);
    setPanel({ name: league, mode });
    if (mode === "rename") setNewName(league);
  };

  const add = async () => {
    setError("");
    const n = cleanName(name);
    if (!n) return;
    if (leagues?.some((l) => l.name.toLowerCase() === n.toLowerCase())) return setError("That league already exists.");
    try {
      const l = await saveLeague(newLeague(n));
      setLeagues((ls) => [...(ls ?? []), l].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const rename = async (from: string) => {
    setError("");
    const to = cleanName(newName);
    if (!to) return setError("Enter a league name.");
    if (to === from) return setPanel(null);
    setBusy(true);
    try {
      await renameLeague(from, to);
      setPanel(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (league: string) => {
    setError("");
    const n = count(league);
    const msg =
      n > 0
        ? `Delete the league "${league}" AND its ${n} game${n === 1 ? "" : "s"}?\n\nThe games and their stats are removed permanently. This cannot be undone.`
        : `Delete the league "${league}"? This cannot be undone.`;
    if (!confirm(msg)) return;
    setBusy(true);
    try {
      await deleteLeague(league);
      setPanel(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1>Leagues</h1>
      <p className="small muted">
        Each league has its own scoring. Rule changes apply to games started afterward; games already played keep
        the rules they were scored with.
      </p>
      {leagues === null && <p className="muted">Loading…</p>}
      {error && <div className="banner err">{error}</div>}
      {leagues?.map((l) => (
        <div key={l.name} className="card">
          <div>
            <strong>{l.name}</strong>
            <div className="small muted">
              {count(l.name)} game{count(l.name) === 1 ? "" : "s"}
            </div>
          </div>
          <div className="row wrap-row" style={{ marginTop: 10 }}>
            <button
              className={`btn sm${panel?.name === l.name && panel.mode === "scoring" ? " primary" : ""}`}
              onClick={() => toggle(l.name, "scoring")}
            >
              Scoring
            </button>
            <button
              className={`btn sm${panel?.name === l.name && panel.mode === "rename" ? " primary" : ""}`}
              onClick={() => toggle(l.name, "rename")}
            >
              Rename
            </button>
            <button className="btn sm danger" disabled={busy} onClick={() => remove(l.name)}>
              Delete
            </button>
          </div>
          {panel?.name === l.name && panel.mode === "rename" && (
            <div className="row" style={{ marginTop: 12 }}>
              <input
                type="text"
                className="grow"
                aria-label="New league name"
                autoCapitalize="words"
                maxLength={60}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && rename(l.name)}
              />
              <button className="btn primary" disabled={busy} onClick={() => rename(l.name)}>
                Save
              </button>
            </div>
          )}
          {panel?.name === l.name && panel.mode === "scoring" && (
            <RulesEditor
              league={l}
              onSaved={(saved) => setLeagues((ls) => ls!.map((x) => (x.name === saved.name ? saved : x)))}
            />
          )}
        </div>
      ))}

      <h2>Add a league</h2>
      <div className="row">
        <input
          type="text"
          className="grow"
          placeholder="League name"
          autoCapitalize="words"
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn primary" onClick={add}>Add</button>
      </div>
    </>
  );
}

function RulesEditor({ league, onSaved }: { league: League; onSaved: (l: League) => void }) {
  // Edit as text so a minus sign can be typed on any keyboard.
  const toText = (r: Rules) => ({
    lines: r.lines.map((l) => String(l.value)),
    rounds: r.rounds.map((x) => String(x.min)),
  });
  const [text, setText] = useState(toText(league.rules));
  const [msg, setMsg] = useState("");

  const valid = [...text.lines, ...text.rounds].every((t) => /^-?\d+$/.test(t.trim()));

  const save = async (rules: Rules) => {
    setMsg("Saving…");
    try {
      const saved = await saveLeague({ ...league, rules });
      onSaved(saved);
      setText(toText(saved.rules));
      setMsg("✓ Saved");
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  const build = (): Rules => ({
    lines: league.rules.lines.map((l, i) => ({ ...l, value: parseInt(text.lines[i], 10) })),
    rounds: league.rules.rounds.map((_, i) => ({ min: parseInt(text.rounds[i], 10) })),
  });

  const field = (value: string, onChange: (v: string) => void, label: string) => (
    <input
      type="text"
      inputMode="text"
      aria-label={label}
      style={{ width: 96, textAlign: "right" }}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^\d-]/g, ""))}
    />
  );

  return (
    <div style={{ marginTop: 12 }}>
      <div className="section-title">Points per line</div>
      <div className="stack">
        {league.rules.lines.map((l, i) => (
          <div key={l.key} className="row">
            <span className="grow">
              {l.label}
              <span className="small muted">
                {autoOf(l) ? " (automatic, 10+ books)" : l.kind === "toggle" ? " (one team)" : " (each)"}
              </span>
            </span>
            {field(text.lines[i], (v) => setText((t) => ({ ...t, lines: t.lines.map((x, j) => (j === i ? v : x)) })), l.label)}
          </div>
        ))}
      </div>
      <div className="section-title">Minimum to lay down</div>
      <div className="stack">
        {league.rules.rounds.map((_, i) => (
          <div key={i} className="row">
            <span className="grow">Round {i + 1}</span>
            {field(text.rounds[i], (v) => setText((t) => ({ ...t, rounds: t.rounds.map((x, j) => (j === i ? v : x)) })), `Round ${i + 1} minimum`)}
          </div>
        ))}
      </div>
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn primary grow" disabled={!valid} onClick={() => save(build())}>Save scoring</button>
        <button className="btn" onClick={() => confirm("Reset this league to the standard scoring?") && save(DEFAULT_RULES)}>
          Reset
        </button>
      </div>
      {msg && <p className="small muted" style={{ marginBottom: 0 }}>{msg}</p>}
    </div>
  );
}

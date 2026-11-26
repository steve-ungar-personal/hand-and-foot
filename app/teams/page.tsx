"use client";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { createTeam, deleteTeam, fetchGames, fetchTeams, updateTeam } from "@/lib/client";
import { Game, MAX_TEAM_PLAYERS, SavedTeam, cleanName, sameName, teamProblem } from "@/lib/game";
import { allPlayerNames } from "@/lib/stats";

type TeamInput = { name: string; players: string[] };

export default function TeamsPage() {
  const [teams, setTeams] = useState<SavedTeam[] | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [editing, setEditing] = useState("");
  const [added, setAdded] = useState(0); // bumps to clear the add form
  const [error, setError] = useState("");

  const load = async () => {
    const [ts, gs] = await Promise.all([fetchTeams(), fetchGames().catch(() => [] as Game[])]);
    setTeams(ts);
    setGames(gs);
  };

  useEffect(() => {
    load().catch((e) => {
      setError(`Couldn't load teams: ${e.message}`);
      setTeams([]);
    });
  }, []);

  const known = [...new Set([...allPlayerNames(games), ...(teams ?? []).flatMap((t) => t.players)])].sort((a, b) =>
    a.localeCompare(b),
  );
  const count = (name: string) => games.filter((g) => g.teams.some((t) => t.name && sameName(t.name, name))).length;

  const remove = async (name: string) => {
    if (!confirm(`Delete the saved team "${name}"?\n\nGames already played keep it, and their stats are not changed.`))
      return;
    setError("");
    try {
      await deleteTeam(name);
      setEditing("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <>
      <Link href="/admin" className="small">← Admin</Link>
      <h1>Teams</h1>
      <p className="small muted">
        Saved teams can be picked when you start a game. Renaming a team also renames it on past games; changing
        its players only affects new games.
      </p>
      <datalist id="players">
        {known.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      {teams === null && <p className="muted">Loading…</p>}
      {error && <div className="banner err">{error}</div>}
      {teams?.length === 0 && !error && <p className="muted">No saved teams yet.</p>}

      {teams?.map((t) => (
        <div key={t.name} className="card">
          <strong>{t.name}</strong>
          <div>{t.players.join(" & ")}</div>
          <div className="small muted">
            {count(t.name)} game{count(t.name) === 1 ? "" : "s"} under this name
          </div>
          <div className="row wrap-row" style={{ marginTop: 10 }}>
            <button
              className={`btn sm${editing === t.name ? " primary" : ""}`}
              onClick={() => setEditing(editing === t.name ? "" : t.name)}
            >
              Edit
            </button>
            <button className="btn sm danger" onClick={() => remove(t.name)}>
              Delete
            </button>
          </div>
          {editing === t.name && (
            <TeamForm
              team={t}
              known={known}
              submitLabel="Save team"
              onSubmit={async (next) => {
                await updateTeam(t.name, next);
                setEditing("");
                await load();
              }}
            />
          )}
        </div>
      ))}

      <h2>Add a team</h2>
      <div className="card">
        <TeamForm
          key={added}
          known={known}
          submitLabel="Add team"
          onSubmit={async (next) => {
            await createTeam(next);
            setAdded((n) => n + 1);
            setError("");
            await load();
          }}
        />
      </div>
    </>
  );
}

function TeamForm({
  team,
  known,
  submitLabel,
  onSubmit,
}: {
  team?: SavedTeam;
  known: string[];
  submitLabel: string;
  onSubmit: (t: TeamInput) => Promise<void>;
}) {
  const [name, setName] = useState(team?.name ?? "");
  const [players, setPlayers] = useState(team ? [...team.players] : ["", ""]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const id = useId(); // the edit and add forms can both be open

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const cleaned = {
      name: cleanName(name),
      // Match an existing player's spelling regardless of case.
      players: players
        .map(cleanName)
        .filter(Boolean)
        .map((p) => known.find((k) => k.toLowerCase() === p.toLowerCase()) ?? p),
    };
    const problem = teamProblem(cleaned.name, cleaned.players);
    if (problem) return setError(problem);
    setBusy(true);
    try {
      await onSubmit(cleaned);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="stack" style={{ marginTop: team ? 12 : 0 }}>
      <div>
        <label className="field" htmlFor={`${id}-name`}>Team name</label>
        <input
          id={`${id}-name`}
          type="text"
          autoCapitalize="words"
          autoComplete="off"
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      {players.map((p, i) => (
        <div key={i}>
          <label className="field" htmlFor={`${id}-player-${i}`}>Player {i + 1}</label>
          <div className="row">
            <input
              id={`${id}-player-${i}`}
              type="text"
              className="grow"
              list="players"
              autoCapitalize="words"
              autoComplete="off"
              maxLength={60}
              value={p}
              onChange={(e) => setPlayers((ps) => ps.map((x, j) => (j === i ? e.target.value : x)))}
            />
            {players.length > 1 && (
              <button
                type="button"
                className="icon-btn"
                aria-label={`Remove player ${i + 1}`}
                onClick={() => setPlayers((ps) => ps.filter((_, j) => j !== i))}
              >
                ×
              </button>
            )}
          </div>
        </div>
      ))}
      {error && <div className="banner err">{error}</div>}
      <div className="row">
        {players.length < MAX_TEAM_PLAYERS && (
          <button type="button" className="btn" onClick={() => setPlayers((ps) => [...ps, ""])}>
            + Add player
          </button>
        )}
        <button type="submit" className="btn primary grow" disabled={busy}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

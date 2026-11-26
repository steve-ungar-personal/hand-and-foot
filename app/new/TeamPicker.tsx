import { SavedTeam, cleanName, sameName, samePlayers } from "@/lib/game";

/** Saved-team dropdown and optional name for one team on the new game screen. */
export default function TeamPicker({
  id,
  name,
  players,
  saved,
  takenNames,
  updateSaved,
  onName,
  onPick,
  onUpdateSaved,
}: {
  id: string;
  name: string;
  players: string[];
  saved: SavedTeam[];
  /** Names used by the other teams in this game. */
  takenNames: string[];
  updateSaved: boolean;
  onName: (name: string) => void;
  onPick: (team: SavedTeam) => void;
  onUpdateSaved: (on: boolean) => void;
}) {
  const typed = cleanName(name);
  const match = saved.find((s) => sameName(s.name, typed));
  const lineup = players.map(cleanName).filter(Boolean);
  const changed = !!match && lineup.length > 0 && !samePlayers(match.players, lineup);

  return (
    <div className="stack" style={{ marginBottom: 10 }}>
      {saved.length > 0 && (
        <select
          aria-label="Choose a saved team"
          value={match?.name ?? ""}
          onChange={(e) => {
            const s = saved.find((x) => x.name === e.target.value);
            if (s) onPick(s);
            else onName("");
          }}
        >
          <option value="">Choose a saved team…</option>
          {saved.map((s) => (
            <option key={s.name} value={s.name} disabled={takenNames.some((n) => sameName(n, s.name))}>
              {s.name} ({s.players.join(" & ")})
            </option>
          ))}
        </select>
      )}
      <div>
        <input
          id={id}
          type="text"
          aria-label="Team name (optional)"
          autoCapitalize="words"
          autoComplete="off"
          maxLength={60}
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder="Team name (optional)"
        />
        {typed && !match && (
          <p className="small muted" style={{ margin: "6px 0 0" }}>
            This team will be saved when the game starts.
          </p>
        )}
        {changed && (
          <label className="check small">
            <input type="checkbox" checked={updateSaved} onChange={(e) => onUpdateSaved(e.target.checked)} />
            <span>
              Update saved team “{match.name}” to these players (it has {match.players.join(" & ")}). Leave unticked
              for a one-time change.
            </span>
          </label>
        )}
      </div>
    </div>
  );
}

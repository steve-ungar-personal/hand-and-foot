# Hand & Foot Scores

Mobile-first score keeper for Hand and Foot with leagues, per-league scoring rules,
saved/resumable games, and player/partnership stats.

## Run locally

```
npm install
npm run dev
```

Without a database URL, local dev stores data in `.data/db.json`.

## Deploy

Deploys run from GitHub Actions (`.github/workflows/deploy.yml`) on every push to `main`
(or manually from the Actions tab). The Vercel project is intentionally **not** connected to Git.

One-time setup:

1. Signed in to the **LoserLeague** Vercel account, create a token at https://vercel.com/account/tokens (scope: loser-league) and add it to the GitHub repo as the
   secret `VERCEL_TOKEN` (Settings → Secrets and variables → Actions → New repository secret).
2. In Vercel (loser-league team), open the `hand-and-foot` project → **Storage → Create Database → Neon** (free plan) and
   connect it to the project. This sets `DATABASE_URL`. Re-run the workflow afterward.

Tables are created automatically on first use. Neon's free tier sleeps when idle and wakes on the next request.

## Notes

- **Leagues**: each game belongs to a league. *New game* defaults to the first league alphabetically.
  Leagues have their own scoring (point values, round minimums), editable under *Admin → Leagues*.
  A game keeps the rules it was started with.
- **Teams**: name a team to remember it, then pick it when starting a game. Naming a new team on the
  *New game* screen saves it; changing a saved team's players there only updates it if you tick the box.
  Under *Admin → Teams* you can add, edit and delete them. Renaming also renames it on past games; changing
  players or deleting leaves past games as they were.
- **Stats**: filter by league and by team (the players who played together). *Admin* needs no sign-in.
- **Filters**: League, Player and Team choices carry across pages until the app is closed. Starting a game
  moves the League filter to that game's league.
- **Saving**: every change auto-saves. With no signal, changes are kept on the phone and sync later.
- **Backup**: *Games → Download backup (JSON)*.
- **Daily backup**: a Vercel cron job (`vercel.json`, 10:00 UTC) calls `/api/backup`, which saves games,
  leagues and teams to `backups/` in Blob storage. One-time setup in Vercel: connect a **private** Blob
  store to the project (Storage tab), add a `CRON_SECRET` environment variable (a long random string)
  for Production, then redeploy. Download backups from the store's page. Each successful run deletes backups older than 90 days.

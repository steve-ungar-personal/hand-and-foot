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

- **Leagues**: each game belongs to a league. A device remembers the last league it used and defaults to it.
  Leagues have their own scoring (point values, round minimums), editable under *Leagues*.
  A game keeps the rules it was started with.
- **Saving**: every change auto-saves. With no signal, changes are kept on the phone and sync later.
- **Backup**: *Games → Download backup (JSON)*.

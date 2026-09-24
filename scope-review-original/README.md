# Scope Review — original standalone source (archive)

Copied from the last working `scope-review` Vercel deployment (Next.js 14,
deployed by CLI, never in git) so it isn't lost while it's being ported into
the CRM. Reference only: nothing here is built or deployed (CRA builds `src/`,
Vercel functions come from the root `api/`).

- `pages/api/analyze.js` — the six Claude modes and all prompts
- `pages/index.js` — UI, batches-of-3 orchestration, supplement workflow
- `pages/api/history.js` — save/load/delete against the old `analyses` table

Not included: `pages/_app.js`, `styles/globals.css`, `package.json` (next 14.2.35,
react 18.2.0). Move this folder to the `scope-review` repo (or delete it) once the
port is live.

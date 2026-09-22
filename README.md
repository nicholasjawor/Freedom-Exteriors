# Bid Mailer — CSV Import (Step 2)

## 1. Unzip into your repo
Unzip this so the folders land at the root of your existing repo (same level
as `package.json`). It should merge in as:

```
your-repo/
  lib/csv-import/parseHailTraceCsv.js
  scripts/import-hailtrace-csv.mjs
  test-fixtures/sample_export.csv
  test-fixtures/run-parser-test.mjs
```

## 2. Install dependencies
```
npm install papaparse @supabase/supabase-js
```

## 3. Make sure your repo's package.json has `"type": "module"`
Open `package.json` and confirm this line exists at the top level:
```json
"type": "module",
```
(If it's already there — likely, since your CRM is React/Vercel — skip this.)

## 4. Sanity-check the parser (no DB, no network, no risk)
```
node test-fixtures/run-parser-test.mjs
```
You should see 9/9 "PASS" lines. If anything fails, stop and paste the output
back to me before going further.

## 5. Dry-run against a REAL HailTrace export
Export a storm event's addresses from HailTrace (Company Settings → Export
Data), then:
```
node scripts/import-hailtrace-csv.mjs --file=./path/to/real_export.csv --campaign="Storm Name" --dry-run
```
Check the "Header map" it prints — confirm `address` (and ideally city/state/
zip/homeowner name) all matched real columns. If `address` didn't match,
open `lib/csv-import/parseHailTraceCsv.js`, find `HEADER_ALIASES`, and add
your CSV's actual header text to the `address` array.

## 6. Set your Supabase credentials
Add to your `.env` (or Vercel project env vars):
```
SUPABASE_URL=https://klfrqwplazjryeppamtk.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<get this from Supabase dashboard → Project Settings → API → service_role key>
```
The service role key is secret — never expose it in frontend code, only in
server-side scripts/env.

## 7. Real import (writes to your database)
Drop `--dry-run` once step 5 looks correct:
```
node scripts/import-hailtrace-csv.mjs --file=./path/to/real_export.csv --campaign="Storm Name"
```
It will create the campaign (or reuse one with that exact name), skip
anything already imported for that campaign, and write a
`*.skipped-report.csv` next to your source file listing anything it couldn't
import and why.

## Known open item (not yet fixed — needs your decision)
`mail_campaigns` and `mail_targets` currently have **Row Level Security
disabled**, unlike the rest of your CRM's tables. That means the anon key can
read/write every row until you enable it. Tell me what access rules you want
(e.g. "service role only") and I'll apply it directly.

## ABC Supply live pricing (Pricing Settings → cross-check only)

`GoodBetterBest.js`'s Pricing Settings screen has an "ABC Supply Live
Pricing" section — never auto-applied to Good/Better/Best, just a reference
you decide whether to act on. `api/abc-supply-pricing.js` is a thin
forwarder to a **shared Supabase Edge Function** (`abc-supply-pricing`,
deployed in this app's own Supabase project — `klfrqwplazjryeppamtk`) that
also serves the separate bid-estimator app, so the real OAuth2/Price Items
integration and the ABC client secret live in exactly one place instead of
being duplicated across both apps' codebases.

Required Vercel env vars (this app doesn't hold the ABC secret itself):
- `ABC_SUPPLY_EDGE_FUNCTION_URL` = `https://klfrqwplazjryeppamtk.supabase.co/functions/v1/abc-supply-pricing`
- `ABC_SUPPLY_INTERNAL_API_KEY` — must match the Edge Function's `INTERNAL_API_KEY` secret

**Still needs your action**: the Edge Function's own Supabase secrets
(`ABC_SUPPLY_CLIENT_ID`, `ABC_SUPPLY_CLIENT_SECRET`, `ABC_SUPPLY_ENV`,
`INTERNAL_API_KEY`) haven't been set — do that via the Supabase Dashboard
(Edge Functions → abc-supply-pricing → Secrets) or `supabase secrets set`,
not via either app's codebase; also a Sandbox Ship-To number (via `Search
Accounts`) and real item numbers (via `Search Items`) — neither endpoint's
exact path is confirmed yet, so look them up via the Developer Portal
directly for now.

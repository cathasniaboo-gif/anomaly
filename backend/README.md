# UAE Reg backend

The live data source behind the mobile app's **Updates** tab and (optionally) real push
notifications. It does three things:

1. **Serves published updates** to the app: `GET /api/updates`.
2. **Discovers candidate new updates** from FTA/MoF publication pages on a schedule, and queues
   them as `pending` for human review — it never auto-publishes a scraped item.
3. **Publishes reviewed updates and pushes to registered devices** when a curator approves one.

## ⚠️ Read this before trusting the scraper

This backend was built in a sandboxed environment with **no outbound network access to
`tax.gov.ae`, `mof.gov.ae`, or almost anything outside npm/GitHub** — confirmed by testing (see
`test/scraper.smoke.ts` output and the run log below). That means:

- The listing URLs in `src/scraper/sources.ts` are **best-effort guesses**, not confirmed
  current pages — government sites restructure without notice.
- The selector-guessing logic in `src/scraper/parseListing.ts` was validated against synthetic
  fixtures (`test/fixtures/*.html`, representing a table layout and a card/Drupal-style layout —
  run `npm run smoke:scraper` to see it pass), **never against the real markup**.
- When I ran `POST /api/admin/scrape/run` against the real URLs from this environment, it
  correctly failed closed rather than crashing or fabricating data:
  ```
  "message": "Fetch failed: HTTP 403. Check listUrl in sources.ts is still current, and that
  this host can reach https://tax.gov.ae."
  ```
  That 403 is this sandbox's own network policy blocking the request — not evidence the scraper
  works against the real site. It proves the *failure path* works cleanly, nothing more.

**Before relying on this in production:**

1. From a machine with normal internet access, open each `listUrl` in `sources.ts` and confirm
   it's still the right page.
2. Run `npm run scrape:once` (or `POST /api/admin/scrape/run`) against the real site and check
   `GET /api/admin/scrape/runs`. If `found` is 0, or `message` mentions no selector scoring well,
   `parseListing.ts` needs a selector added for that page's actual structure — or the page
   renders its list client-side, in which case swap `fetchHtml.ts` for a headless-browser fetch
   (e.g. Playwright, already used elsewhere in this repo for testing the mobile app).
3. Check the site's terms of use / `robots.txt` for automated-access restrictions before
   scraping it on a schedule.

Because of this gap, the design leans on a human review step rather than trusting the scraper
end to end: a scraped item lands as `pending` with only a title/date/link and a raw excerpt —
nothing reaches an end user's phone until a curator has written the plain-English summary and
published it via the admin API. That review gate is also just good practice for anything
claiming to simplify tax law, independent of the scraper's reliability.

## API

All responses are JSON.

### Public (used by the mobile app)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | liveness check |
| GET | `/api/updates` | published updates, newest first. `?since=<ISO timestamp>` filters to items updated after that time |
| GET | `/api/updates/:id` | one published update |
| POST | `/api/devices/register` | `{ token, platform }` — registers an Expo push token |
| DELETE | `/api/devices/:token` | unregister |

### Admin (require header `x-admin-key: <ADMIN_API_KEY>`)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/updates?status=pending\|published` | review queue |
| POST | `/api/admin/updates` | create an update directly. `status: "pending"` needs only title/date/authority/kind/source; `status: "published"` (default) also requires `summary` + `detail`, and dispatches push immediately |
| PATCH | `/api/admin/updates/:id` | edit any field; setting `status: "published"` on a pending item validates content and dispatches push (once, tracked via an internal `notified` flag) |
| DELETE | `/api/admin/updates/:id` | remove |
| POST | `/api/admin/scrape/run` | trigger a scrape cycle immediately (in addition to the cron schedule) |
| GET | `/api/admin/scrape/runs` | last 50 scrape run results, for diagnosing selector drift |

### Audit: ledger scrutiny (require header `x-admin-key: <ADMIN_API_KEY>`, except the OAuth callback)

A second, independent feature lives alongside the FTA/MoF feed: automated ledger scrutiny for
the mobile app's **Audit** tab. `src/audit/scrutiny.ts` runs a fixed set of rule-based checks —
balance, duplicate postings, weekend postings, round-number bias, a Benford's Law leading-digit
test, reference-number sequence gaps, per-account statistical outliers, incomplete entries,
possible structuring near an approval threshold, and future-dated entries — against any ledger,
whether it arrived as a manually imported CSV or a synced accounting-software connection. Run
`npm run smoke:audit` to see every rule fire against synthetic fixtures.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/audit/rules` | the rule catalogue (id/title/severity/description), for the app to explain what it checks for |
| POST | `/api/audit/ledgers/import` | `{ name, csv }` — parses the CSV (flexible header aliases: Date/Account/Description/Reference/Debit/Credit or a single signed Amount column), runs scrutiny, stores the result |
| GET | `/api/audit/ledgers` | list, newest first, findings/entries stripped |
| GET | `/api/audit/ledgers/:id` | full record: entries, findings, summary |
| POST | `/api/audit/ledgers/:id/rescan` | re-run the current rules against stored entries (e.g. after a rule change) |
| DELETE | `/api/audit/ledgers/:id` | remove |
| GET | `/api/audit/connectors` | QuickBooks Online / Xero: configured?, connected?, company name |
| GET | `/api/audit/connectors/:id/auth-url` | mints a single-use OAuth `state` and returns the provider's authorize URL |
| GET | `/api/audit/connectors/:id/callback` | **not** admin-key gated — reached by the provider's own browser redirect; validated by the single-use `state` token instead |
| POST | `/api/audit/connectors/:id/sync` | fetches the connected company's ledger, runs scrutiny, stores a new snapshot |
| DELETE | `/api/audit/connectors/:id` | disconnect |

**The two accounting-software connectors (QuickBooks Online, Xero) carry the same caveat as the
FTA/MoF scraper above**: built against each provider's public API reference, not exercised
against a live company/org, because this sandbox has no outbound network access to Intuit's or
Xero's endpoints either. See `src/audit/connectors/README.md` for the setup steps and exactly
what's unverified. Manual CSV import and the scrutiny engine itself have no such gap — both are
fully exercised by `npm run smoke:audit`.

## Running it

```bash
cp .env.example .env
# edit .env — at minimum set ADMIN_API_KEY to something random:
#   node -e "console.log(require('crypto').randomUUID())"

npm install
npm run dev          # ts-node-dev, auto-reload
# or:
npm run build && npm start
```

Curate your first update by hand (works with zero scraper calibration):

```bash
curl -X POST http://localhost:4000/api/admin/updates \
  -H "x-admin-key: $ADMIN_API_KEY" -H "Content-Type: application/json" \
  -d '{
    "authority": "FTA", "kind": "Decision", "title": "...",
    "date": "2026-08-01", "summary": "...", "detail": "...",
    "relatedCats": ["Corporate Tax"],
    "sourceLabel": "Cabinet Decision No. ...", "sourceUrl": "https://tax.gov.ae/..."
  }'
```

## Deploying

The service is stateless code + one JSON-file-backed data directory (see "Scaling the
datastore" below) — any small Node host works.

### Render (Blueprint — the fastest path)

`render.yaml` at the repo root already declares the service (build/start commands, health
check, env vars). I couldn't click through this myself: this backend was built in a sandbox
whose network policy blocks `api.render.com` (same allowlist issue that blocks
`tax.gov.ae` — confirmed by testing, not assumed), and I have no Render account credentials
regardless. It's a real ~2 minute manual step on your end:

1. Push this repo (or this branch) to GitHub if it isn't already — Render deploys from a Git
   connection, not a file upload.
2. In the [Render dashboard](https://dashboard.render.com): **New +** → **Blueprint** → connect
   this repo → pick the branch that has `render.yaml` (repo root) → **Apply**.
3. Render finds `render.yaml`, and prompts you for the one secret it deliberately doesn't
   commit: `ADMIN_API_KEY`. Generate one first — `node -e "console.log(require('crypto').randomUUID())"`
   — and paste it in. Save it somewhere; it's how the admin API authenticates you.
4. Click **Deploy**. First build takes a couple of minutes (`npm ci && npm run build`); Render
   then health-checks `GET /api/health` and brings the service up at
   `https://uae-reg-backend-<random>.onrender.com` (or whatever name you gave the Blueprint).
5. Verify it yourself before wiring the app — from any machine with normal internet access:
   ```bash
   curl https://<your-service>.onrender.com/api/health
   ```

**Read this before you rely on it**: the Blueprint defaults to Render's **free plan**, which has
no persistent disk. `render.yaml` deliberately leaves `DATA_DIR` unset in that case — an earlier
version of this file hardcoded it to `/var/data`, which crashed the app on start with `EACCES:
permission denied, mkdir '/var/data'`, because that path only exists once a disk is actually
mounted there. Left unset, the app falls back to a `data/` directory next to its own compiled
code, which is always writable. On the free plan that's still ephemeral — it resets on every
deploy and roughly every 15 minutes of inactivity (free instances spin down and lose local disk
state on the next request, which also means a ~30-60s cold-start delay). That's fine for
verifying the wiring end-to-end, but it means the review queue, scraper dedup index, and
registered device tokens don't survive a restart. For real use: in the Render dashboard, change
the service's instance type off Free, uncomment the `disk:` block in `render.yaml`, **and** add
a `DATA_DIR=/var/data` environment variable (matching `mountPath`) so the app writes to the
persisted disk instead of the ephemeral build directory — then redeploy.

Once it's up, come back and give me the URL — I'll wire `EXPO_PUBLIC_API_BASE_URL` in the
mobile app and verify the app actually talks to it (the same way I verified it against a local
instance: a real fetch, screenshotted, not just a typecheck).

### Docker (self-host anywhere: a VPS, Fly.io, etc.)

```bash
docker build -t uae-reg-backend .
docker run -d -p 4000:4000 \
  -e ADMIN_API_KEY=... \
  -v uae-reg-data:/app/data \
  uae-reg-backend
```

The `-v` volume mount is not optional in production — without it, every redeploy wipes the
review queue, the scraper's dedup index (so it re-discovers and re-queues everything), and the
device registry (so existing devices stop getting push until they reopen the app).

### Railway (no Docker needed)

Same shape as Render without a Blueprint file: point Railway's Node buildpack at this
`backend/` directory, build command `npm ci && npm run build`, start command `npm start`, and
attach a persistent volume mounted at the path you set as `DATA_DIR`. Set `ADMIN_API_KEY` (and
optionally `SCRAPE_CRON`) as environment variables in Railway's dashboard.

Whichever host you pick, note its public URL — the mobile app needs it as
`EXPO_PUBLIC_API_BASE_URL` (see the root README's mobile-app setup).

## Enabling real push notifications

1. In the mobile app, run `eas init` (needs a free Expo account) to get an EAS project id, and
   add it to `app.json` as `expo.extra.eas.projectId`.
2. Set `EXPO_PUBLIC_API_BASE_URL` when building/running the app to point at your deployed
   backend. On next launch the app registers its Expo push token via `POST
   /api/devices/register` automatically (`src/services/pushRegistration.ts`).
3. Publish an update (`POST /api/admin/updates` with `status: "published"`, or `PATCH` a pending
   one to `published`) — `src/push.ts` dispatches to every registered device via
   `expo-server-sdk`. Dead tokens (`DeviceNotRegistered`) are pruned automatically.

Note: sending a push still requires this backend to reach Expo's push service
(`exp.host`/`api.expo.dev`) — outside this development sandbox, so untested here for the same
reason the scraper is unverified. The dispatch code path itself (chunking, ticket handling,
stale-token cleanup) is exercised by `push.ts`'s logic and the admin-route smoke test, just not
an actual delivered notification.

## Scaling the datastore

`src/db.ts` is a small JSON-file store (one file per collection, atomic write-via-rename, a
write queue that survives a failed write instead of jamming forever) — plenty for the write
volume here (a handful of new updates a week, occasional device registrations). Its ceiling:
it's file-based, so only one backend instance can safely write to a given `DATA_DIR` at a time.
If you need multiple instances behind a load balancer, swap `JsonCollection` for a real database
(Postgres via `pg`, or SQLite via `better-sqlite3` if a single-writer file-based DB is still
fine but you want proper querying) — `UpdateRecord`/`DeviceRecord` in `src/types.ts` already
define the schema to migrate to.

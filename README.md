# UAE Reg — UAE Tax & Regulatory Consultant

A mobile app (Expo / React Native, iOS + Android + web) that acts as a quick-reference and
"ask a question" virtual consultant for UAE Corporate Tax, VAT, free zones vs. mainland,
business formation, IFRS/IAS, AML/CFT, labour law, immigration, data protection and more —
plus a feed of new FTA/MoF guidance with plain-English summaries.

Built from the single-page reference design in `002928f1-uaeregapp.html` (same palette, type
scale and card layout), expanded into a full four-tab native app.

## Features

- **Home** — key stats (corporate tax rate, VAT rate, DMTT minimum ETR, QFZP rate) and a
  browsable topic list (13 categories, 60+ Q&A entries) ported from the reference design, plus
  a full-text **Search** screen.
- **Ask a Consultant** — a chat-style screen that answers free-text questions by matching them
  against the bundled knowledge base (keyword/overlap scoring, entirely on-device — no network
  call, nothing sent anywhere). Confident answers are shown inline with their source; uncertain
  matches are offered as tappable "closest topics" instead of guessing.
- **Updates** — a feed of FTA/MoF/IASB decisions, guidelines and public clarifications, each
  with a one-line plain-English summary, an unread badge on the tab icon, pull-to-refresh, and a
  notification the first time the device sees a new item. Works fully offline against bundled
  seed data out of the box; point it at the backend in `backend/` (see below) for a live feed
  and real server-sent push.
- **Audit** — connect the app to a self-hosted backend (see `backend/`) and run automated ledger
  scrutiny: import a CSV export from any accounting package or spreadsheet, or connect
  QuickBooks Online / Xero and sync its general ledger directly, and every transaction is run
  through a rule-based scrutiny engine — balance check, duplicate postings, round-number bias, a
  Benford's Law leading-digit test, reference-number sequence gaps, per-account statistical
  outliers, incomplete entries, possible structuring near an approval threshold, weekend
  postings, and future-dated entries. Findings are graded high/medium/low and drill down to the
  exact entries behind each one. Off by default until a backend URL + admin key are entered in
  Audit settings — see `backend/README.md`'s "Audit: ledger scrutiny" section for the API and
  `backend/src/audit/connectors/README.md` for connecting an accounting package.
- **About & sources** — scope, disclaimer, and links to the primary government/standard-setter
  sources.

## Tech stack

- Expo SDK 57 + React Native 0.86, TypeScript (strict)
- React Navigation (bottom tabs, one native-stack per tab)
- `@react-native-async-storage/async-storage` for read/unread + notification state
- `expo-notifications` for local (device-only) push
- `@expo-google-fonts/fraunces` + `@expo-google-fonts/ibm-plex-sans` to match the reference type
  scale

## Running it

```bash
npm install
npm run start     # Expo dev server — scan the QR code with Expo Go (iOS/Android)
npm run ios        # iOS simulator (macOS + Xcode)
npm run android     # Android emulator
npm run web         # Runs in a browser via react-native-web (handy for quick UI iteration)
```

Runs fully offline with zero setup — Updates and Ask both work against bundled data. To connect
the live backend (see `backend/README.md`):

```bash
cp .env.example .env
# edit .env: EXPO_PUBLIC_API_BASE_URL=https://your-deployed-backend.example.com
npm run start
```

## Project structure

```
App.tsx                        # font loading, providers, navigation container
src/
  config.ts                    # EXPO_PUBLIC_API_BASE_URL — unset means "offline, bundled data"
  data/
    knowledgeBase.ts           # the Q&A reference content (13 categories, 60+ entries)
    updates.ts                 # bundled offline seed/fallback feed of FTA/MoF/IASB updates
  services/
    answerEngine.ts            # on-device question -> knowledge-base matching
    notifications.ts           # expo-notifications wrapper (local notifications)
    updatesApi.ts               # fetches live updates from backend/, null on any failure
    pushRegistration.ts         # registers this device for real server-sent push
    auditSettings.ts            # on-device audit backend URL + admin key (AsyncStorage only)
    auditApi.ts                  # /api/audit/* client, admin-key gated
  context/
    UpdatesContext.tsx         # live fetch + fallback, unread tracking, notify-new-items logic
  navigation/                  # bottom tabs + per-tab stacks
  screens/                     # Home, Category, Detail, Search, Ask, Updates, About
  screens/audit/                # Audit tab: settings, import, connect, ledger + finding detail
  components/UI.tsx            # shared cards/rows/pills styled from theme/theme.ts
  components/AuditUI.tsx        # severity pills, finding-count chips, currency/date formatting
  theme/theme.ts                # colors/fonts ported from the reference CSS
backend/                       # live FTA/MoF feed + audit ledger scrutiny — see backend/README.md
  src/audit/                   # scrutiny rule engine, CSV importer, QuickBooks/Xero connectors
```

## Scope and disclaimer

Content is current to September 2026 per the source reference and is provided for general
orientation only — it is not tax, legal or audit advice, and does not cover every free zone
authority's local rules. Always verify anything material against the primary source or a
licensed UAE tax agent / auditor. This is reflected in-app on the Detail and About screens.

## Connecting a real language model

`src/services/answerEngine.ts` is a deliberately simple, fully offline keyword-matching
retriever over the bundled knowledge base — it works with zero backend and never transmits a
user's question. To upgrade "Ask a Consultant" to a generative assistant:

1. Stand up a small backend endpoint (or use a serverless function) that calls an LLM API with
   the user's question plus the matched `KnowledgeItem`s from `matchQuestion()` as grounding
   context (retrieval-augmented generation), so answers stay anchored to the same sourced
   content instead of hallucinating law.
2. Replace the call to `answerQuestion()` in `src/screens/AskScreen.tsx` with a `fetch` to that
   endpoint, keeping the same `ConsultantAnswer` shape (or extend it) so the rest of the UI
   (source links, alternatives list) keeps working unchanged.
3. Keep the local `answerEngine.ts` as an offline fallback for when the network is unavailable.

## The live FTA/MoF feed (`backend/`)

`backend/` is a real, deployable Node service that:

- serves published updates to `GET /api/updates` (the app fetches this in
  `UpdatesContext.tsx`, falling back to the bundled seed if unreachable — the app never breaks
  from a backend outage, it just goes offline-static);
- scrapes candidate new items from FTA/MoF publication pages on a schedule and queues them as
  `pending` for human review (never auto-publishes — see below for why);
- dispatches a real push notification via Expo's push service to every registered device when a
  curator publishes an item, so it reaches phones even when the app isn't open.

**Read `backend/README.md` before trusting the scraper against production**: it was built and
tested in a sandbox with no outbound network access to `tax.gov.ae`/`mof.gov.ae`, so the listing
URLs and CSS-selector guessing are unverified against the real site — only against synthetic
fixtures. The rest of the backend (API, review-queue workflow, push dispatch, data persistence)
was fully exercised end to end, including the compiled production build. The review-queue design
is deliberate independent of that gap, too: a scraper shouldn't be trusted to write a
"simplified summary" of tax law on its own — a human fills in `summary`/`detail` before anything
publishes.

To connect the app:

```bash
# in backend/
cp .env.example .env   # set ADMIN_API_KEY
npm install && npm run dev

# in the project root
cp .env.example .env   # set EXPO_PUBLIC_API_BASE_URL=http://localhost:4000 (or your deployed URL)
npm run start
```

See `backend/README.md` for the full API reference, Docker/Render/Railway deployment steps, and
how to enable real (app-closed) push notifications via `eas init`.

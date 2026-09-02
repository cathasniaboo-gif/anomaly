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
  with a one-line plain-English summary, an unread badge on the tab icon, and a local push
  notification the first time the device sees a new item (`expo-notifications`).
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

## Project structure

```
App.tsx                        # font loading, providers, navigation container
src/
  data/
    knowledgeBase.ts           # the Q&A reference content (13 categories, 60+ entries)
    updates.ts                 # seed feed of FTA/MoF/IASB updates
  services/
    answerEngine.ts            # on-device question -> knowledge-base matching
    notifications.ts           # expo-notifications wrapper (local notifications only)
  context/
    UpdatesContext.tsx         # unread tracking + "notify once per new update" logic
  navigation/                  # bottom tabs + per-tab stacks
  screens/                     # Home, Category, Detail, Search, Ask, Updates, About
  components/UI.tsx            # shared cards/rows/pills styled from theme/theme.ts
  theme/theme.ts                # colors/fonts ported from the reference CSS
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

## Wiring a real FTA feed

`src/data/updates.ts` is a static seed array today. To make "Updates" a live feed:

1. Stand up a scheduled job (cron / cloud function) that polls the FTA/MoF publications pages
   (or an internal content pipeline that summarises them) and writes new entries — matching the
   `RegUpdate` shape in `src/types/index.ts` — to a small backend API or database.
2. In `src/context/UpdatesContext.tsx`, replace the `sortedUpdates()` import with a `fetch`
   against that API (e.g. on app foreground, or via a background fetch task), diffing against
   the last-seen IDs already tracked in `AsyncStorage`.
3. The existing unread-badge and "notify once per new item" logic (`notifyNewUpdate` in
   `src/services/notifications.ts`) needs no changes — it already keys off update `id`, so newly
   fetched items are picked up automatically.
4. For a notification that fires even when the app isn't open, add a push-notification token
   flow (`expo-notifications` push, not local) and have your backend push to devices when it
   detects a new publication, rather than relying on the app being opened to notice it.

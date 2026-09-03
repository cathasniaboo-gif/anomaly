# Accounting software connectors

Each connector implements the `AccountingConnector` interface in
`types.ts`: build an OAuth2 authorize URL, exchange a code for tokens,
refresh, and fetch the general ledger mapped into this app's
`LedgerEntry[]` shape (see `../types.ts`).

**Built against each provider's public API reference, not exercised against
a live company/org** — this sandbox has no outbound network access to
Intuit's or Xero's endpoints. Same caveat as the FTA/MoF scraper (see the
root `backend/README.md`): the code follows the documented request/response
shapes, but treat the first real sync as a test, not a given. If something
doesn't map correctly (a field renamed, a paginated response, a
positive/negative sign convention that's the other way round from what's
assumed here), fix the one `mapJournal*`/`mapJournalEntries` function in the
relevant connector file — the rest of the audit pipeline (storage, scrutiny
rules, API, app UI) doesn't need to change.

## Adding a connector

1. Register an OAuth2 app with the provider and note its client id, client
   secret, and the exact redirect URI you'll configure (must match
   `.../api/audit/connectors/<id>/callback` on your deployed backend).
2. Implement `AccountingConnector` in a new file here, add it to the
   `connectors` map in `index.ts`.
3. Add its env vars to `backend/.env.example` and set them in `.env`.
4. `GET /api/audit/connectors` (admin key required) should now show it as
   `configured: true`. `GET /api/audit/connectors/<id>/auth-url` returns the
   URL to open in a browser to connect it.

## QuickBooks Online

- Create an app at [developer.intuit.com](https://developer.intuit.com/).
- Scope used: `com.intuit.quickbooks.accounting`.
- Pulls `JournalEntry` records via the QBO Query API — extend
  `fetchLedgerEntries` in `quickbooks.ts` if you also want Purchases,
  Deposits, Bills, etc. folded into the same ledger.
- `QBO_ENVIRONMENT=sandbox` (default) talks to
  `sandbox-quickbooks.api.intuit.com`; set it to `production` once you're
  ready to point at a real company file.

## Xero

- Create an app at [developer.xero.com](https://developer.xero.com/).
- Scopes used: `openid profile email accounting.transactions.read
  accounting.reports.read offline_access`.
- The OAuth callback doesn't carry a tenant id, so `exchangeCode` makes a
  follow-up call to `/connections` to discover it.
- Pulls the `Journals` endpoint, paginated from offset 0 — extend
  `fetchLedgerEntries` in `xero.ts` if a ledger is large enough to need
  more than the first page.

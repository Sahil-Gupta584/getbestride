# GetBestRide Backend (`apps/backend`)

Long-running Node.js & Express service that scrapes ride fares from Uber, Rapido
and Ola, and serves them over oRPC.

## How fares are collected

Each provider's request is fired **from inside a real browser page** with
`credentials: 'include'`, so authentication comes from the Solari profile's own
session rather than from configuration. There are no per-provider cookies or API
keys to capture and rotate — you seed the profile once and it stays logged in.

- `src/lib/solari/fares.ts` — shared page + in-page `fetch` helper
- `src/lib/solari/{uber,rapido,ola}.ts` — one module per provider
- `src/lib/browser-pool.ts` — the shared-browser registry

Each provider navigates only to the bare origin (`https://m.uber.com/`,
`https://m.rapido.bike/`, `https://book.olacabs.com/`) to pick up its session,
then issues the API call from that page. No forms are filled and no routes are
navigated.

### Shared browser

Launching a browser costs seconds, so concurrent requests share one. The first
request claims the slot and creates the browser; others attach to it. Each gets
its own `Page`, so DOM state never collides. The browser is closed only once the
last in-flight request finishes.

The counter lives in Upstash Redis so multiple backend instances agree on who
owns the browser. Transitions use Lua for atomicity, since Upstash is HTTP-only
and does not support `WATCH`. Redis is required infrastructure, not optional.

`packages/api/scripts/test-browser-pool.mjs` simulates the Lua line-for-line and asserts the
concurrency behaviour without launching real browsers.

## Development

```bash
cd apps/backend
cp .env.example .env
npm run dev
```

## Endpoints

- `GET /health` — Health check
- `POST /rpc/*` — oRPC quotes API, no auth yet (quotes will become authed procedures)

## Quotes API

Procedures live in `packages/api`, next to the scrapers they call:

- `packages/api/src/router/quotes.ts` — procedures with handlers, screenly-style.
- `src/router/index.ts` — mounts the package router on this Express app at `/rpc`.
- The browser calls this API directly with a client typed from `@repo/api`.
  Scrapers never enter the browser bundle because the page only imports the
  client type.

| Procedure | Description |
|---|---|
| `quotes/rapido` · `quotes/uber` · `quotes/ola` | Per-provider; the UI calls these so each card paints independently |
| `quotes/compare` | All three at once, for scripts and debugging |

Provider errors are returned inline as `ok: false` with a message, so one failing
provider cannot blank the others.

## Rapido signing assets

Rapido's fare endpoint is signed and the key ships inside its own client bundle,
so the signing module is vendored under `src/lib/scraper/rapido/assets` and
pinned by SHA-256 in `src/lib/scraper/rapido/signer.ts`. The signature is minted
in Node (where the WASM lives) and only the *request* is sent from the page.

If fares fail with a digest mismatch, Rapido has shipped a new bundle:

```bash
npm run sync:rapido --prefix packages/api -- --write
# then update EXPECTED_SHA256 in src/lib/scraper/rapido/signer.ts
```

This fails loudly with a clear message rather than silently returning no fares.

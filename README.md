# GetBestRide — compare ride fares across Uber, Rapido and Ola

Enter a pickup and a drop, and GetBestRide scrapes live fares from each ride
platform and shows them side by side.

Fares are collected by driving a real browser on a Solari profile and issuing each
provider's request from inside the page, so authentication comes from the
profile's own session rather than from configuration. There are no per-provider
cookies or API keys to capture and rotate.

## Stack

- **Framework**: TanStack Start (Vite + React 19, SSR)
- **Router**: TanStack Router — file-based at `src/routes/`
- **Server API**: oRPC + Zod (`/api/rpc/*`)
- **Database**: Drizzle ORM + PostgreSQL (Supabase) — schema at `apps/web/src/db/schema.ts`
- **Auth**: better-auth — magic link, invite-only — client at `#/lib/auth-client`
- **Fare scraping**: Solari (`@solarisdk/browser`) — persistent profile, in-page `fetch`
- **API**: `@repo/api` — quotes procedures with handlers, next to the scrapers they call
- **Browser registry**: Upstash Redis — shares one browser across concurrent requests
- **Payments**: Dodo Payments — wallet top-up via checkout sessions + webhook
- **UI**: shadcn/ui + Tailwind CSS v4, Nunito

## Monorepo

```
apps/web         — main app (port 3000) — UI, auth, billing, oRPC API
apps/backend     — fare scrapers (port 4000) — POST /rpc
packages/api         — quotes procedures with handlers (@repo/api)
```

## Ride fares

```
packages/api/src/router/quotes.ts   procedures with handlers, screenly-style
packages/api/src/lib/solari/        one module per provider, in-page fetch
packages/api/src/lib/browser-pool.ts shared browser + Redis refcount
apps/backend/src/router/             mounts the package router at POST /rpc
```

The browser calls the backend directly (`POST {VITE_BACKEND_URL}/rpc`) with a
client typed from `@repo/api`. No proxy, no shared secret — quotes will become
authed procedures. Scrapers never enter the browser bundle because the page only
imports the client type.

| Provider | Origin loaded | Request |
|---|---|---|
| Rapido | `m.rapido.bike` | `POST /pwa/api/unup/scc/fareEstimate` (signed) |
| Uber | `m.uber.com` | `POST /go/graphql` (operation `Products`) |
| Ola | `book.olacabs.com` | `GET /data-api/category-fare/p2p` |

Provider failures come back as `ok: false` with a message rather than throwing,
so one dead provider can't blank the other cards.

### Shared browser

Concurrent requests share one Solari browser. The first request creates it,
others attach, each gets its own page, and it is closed once the last in-flight
request finishes. Upstash Redis holds the refcount so multiple backend instances
agree on ownership.

### Rapido

Rapido's fare endpoint is signed and the key ships inside its own bundle, so the
signing module is vendored and pinned by SHA-256. If fares fail with a digest
mismatch, refresh it: `npm run sync:rapido --prefix packages/api -- --write`,
then update `EXPECTED_SHA256` in `apps/backend/src/lib/scraper/rapido/signer.ts`.

## Key conventions

1. **Routing**: Never create dot-nested route files. Use flat directory-based nested routes.
2. **Auth in protected routes**: Never call `authClient.useSession()` inside `_protected/*` pages. Access via `Route.useRouteContext()`.
3. **Env**: import from `#/env` in web, from `../env.js` in the backend. Never use `process.env` directly.
4. **Migrations**: `npm run db:generate` → `npm run db:migrate` (never `db:push`)
5. **API package**: procedures live in `packages/api` next to the scrapers they call, screenly-style. Web never imports them at runtime — only the client type.

## Commands

```bash
npm run dev              # all workspaces
npm run dev:w            # web dev server
npm run dev:b            # backend (quotes oRPC) on port 4000
npm run generate-routes  # after adding routes
npm run db:generate      # from schema changes
npm run db:migrate       # apply migrations
npm run build
npm run check-types
```

## Invite-only access

Insert email into the `invite` table via `npm run db:studio`.

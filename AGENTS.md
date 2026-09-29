# AGENTS.md — GetBestRide

## What is this

GetBestRide compares ride fares across Uber, Rapido and Ola. The user enters a
pickup and a drop; we scrape live fares from each provider and show them side by
side. There is no booking flow.

## Architecture

Monorepo using npm workspaces & Turborepo:
- **`apps/web`**: UI + oRPC API + Better-Auth + Dodo Payments. Deployed to Vercel (fast serverless).
- **`apps/backend`**: Fare scrapers over a real browser (Solari), served over oRPC at `POST /rpc`. Deployed to a long-running host / Docker / Railway — a browser needs a persistent process, not a serverless request.
- **`packages/api`**: Quotes API (`@repo/api`) — procedures with handlers, next to the scrapers they call.

## Stack

- **Dashboard / Web**: TanStack Start (Vite + React 19, SSR)
- **Router**: TanStack Router — file-based at `apps/web/src/routes/`. Never edit `src/routeTree.gen.ts` manually. Run `npm run generate-routes` after adding or renaming routes.
- **Server API**: oRPC with Zod validation (`/api/rpc/*`) in `apps/web`
- **Fare API**: procedures in `packages/api` (`POST /rpc` on the backend Express app). The browser calls the backend directly with a typed client; no proxy, no shared secret.
- **Fare scraping**: Solari (`@solarisdk/browser`) in `apps/backend/src/lib/solari/`. Each provider navigates to its bare origin, then fires its API call via `page.evaluate` with `credentials: 'include'` — auth comes from the profile's session, not from config.
- **Shared browser**: `apps/backend/src/lib/browser-pool.ts`. One browser across concurrent requests, refcounted in Upstash Redis via Lua (Upstash is HTTP-only and has no `WATCH`). Each request gets its own `Page`; the browser closes when the last in-flight request finishes.
- **Database**: Drizzle ORM + PostgreSQL (Supabase) in `apps/web` only.
- **Auth**: better-auth — magic link (invite-only). Client: `#/lib/auth-client`.
- **UI**: shadcn/ui + Tailwind CSS v4. Light theme.

## Import aliases

`#/*` resolves to `./src/*` inside `apps/web`. Web imports `@repo/api` types only, never its runtime.

## Key conventions

1. **Routing**: Never create dot-nested route files (`settings.dashboard.tsx`). Use flat directory-based nested routes (`src/routes/_protected/settings.tsx`).
2. **Auth in protected routes**: Never call `authClient.useSession()` or `getSession()` inside `_protected/*` pages. User is already in context from `_protected.tsx`. Access via `const { user } = Route.useRouteContext()`.
3. **Env variables**: Web imports from `#/env`; the backend from `../env.js`. Never use `process.env` directly.
4. **Forms**: For more than 2 inputs, use react-hook-form + Zod schema resolver. Define schema at top of file, infer type with `z.infer<typeof schema>`.
5. **Database migrations**: NEVER use `db:push`. Always `npm run db:generate` then `npm run db:migrate`.
6. **Types**: Reuse inferred types from `src/db/schema.ts`. Do not create duplicate interfaces.
7. **API package**: procedures live in `packages/api` with the scrapers they call. Never import them at runtime from `apps/web` — only the client type.
8. **Never start a dev server to test.** Build, typecheck, and hand the command to the user.
9. **Rapido signing assets**: If fares fail with a digest mismatch, run `npm run sync:rapido -- --write` in `packages/api` and update `EXPECTED_SHA256` in `packages/api/src/lib/scraper/rapido/signer.ts`. Fares fail loudly rather than returning empty.
10. **Route file size**: If a route file exceeds ~500 lines, extract into a folder with sub-components.
11. **Ask, don't assume**: If intent is unclear, ask before guessing — but do not park a removal you were already told to make.

## Commands

```bash
npm run dev              # start dev servers across all workspaces
npm run dev:w            # start web dev server
npm run dev:b            # start backend (quotes oRPC) on port 4000
npm run generate-routes  # regenerate TanStack Router route tree
npm run db:generate      # generate SQL migration files from schema changes
npm run db:migrate       # apply pending migrations to the database
npm run build            # production build
npm run lint             # lint
```

## Verifying the browser pool

`packages/api/scripts/test-browser-pool.mjs` transliterates the Lua line-for-line
into JS and asserts the concurrency behaviour (one shared browser, closed only
after the last request, stale owners cannot hijack) without launching real
browsers. Run it after any change to `browser-pool.ts`.

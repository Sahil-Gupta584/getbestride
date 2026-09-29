/**
 * Exercises the per-provider quote procedures and the combined wrapper against
 * the live backend. Run:
 *   npx dotenv -e .env -- node --import tsx scripts/smoke-quotes.ts
 */
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { QuotesRouterClient } from '@repo/api/router-types'
import { env } from '#/env'

const client = createORPCClient<QuotesRouterClient>(
  new RPCLink({ url: `${env.QUOTES_BACKEND_URL}/rpc` }),
)

const ROUTES = [
  {
    name: 'Thane',
    pickup: { lat: 19.187982, lng: 72.996397, label: 'Thane C Cabin' },
    drop: { lat: 19.2369772, lng: 72.9666005, label: 'Tikuji-ni-Wadi' },
  },
  {
    name: 'Bengaluru',
    pickup: { lat: 12.9716, lng: 77.5946, label: 'Indiranagar' },
    drop: { lat: 12.9352, lng: 77.6245, label: 'Koramangala' },
  },
]

for (const route of ROUTES) {
  console.log(`\n${'='.repeat(58)}\n${route.name}\n${'='.repeat(58)}`)

  // Per-provider procedures in parallel, exactly as the UI does.
  const t0 = Date.now()
  const [rapido, uber, ola] = await Promise.all([
    client.quotes.rapido(route),
    client.quotes.uber(route),
    client.quotes.ola(route),
  ])
  const elapsed = Date.now() - t0

  for (const result of [rapido, uber, ola]) {
    if (!result.ok) {
      console.log(`  ${result.provider.padEnd(8)} FAILED: ${result.error}`)
      continue
    }
    console.log(`  ${result.provider} — ${result.options.length} options`)
    for (const o of result.options) {
      const band =
        o.minFare === o.maxFare ? `${o.minFare}` : `${o.minFare}-${o.maxFare}`
      console.log(`      ${o.name.padEnd(20)} Rs ${band.padStart(10)}`)
    }
  }
  console.log(`  all three in parallel: ${elapsed}ms`)

  // Combined wrapper, for parity with the per-provider results.
  const combined = await client.quotes.compare(route)
  const okCount = combined.providers.filter((p) => p.ok).length
  console.log(
    `  compare wrapper: ${okCount}/${combined.providers.length} ok, cheapest=${
      combined.cheapest
        ? `${combined.cheapest.provider} ${combined.cheapest.name} Rs ${combined.cheapest.minFare}`
        : 'none'
    }`,
  )
}

/**
 * Verifies that `places.suggest` measures and orders results against an origin.
 * Without one it must keep LocationIQ's relevance order. Run:
 *   npx dotenv -e .env -- node --import tsx scripts/smoke-places.ts
 */
import { createRouterClient } from '@orpc/server'
import { suggestPlaces } from '#/lib/geocode/locationiq'
import router from '#/orpc/router'

const client = createRouterClient(router, {
  context: () => ({ headers: new Headers() }),
})

// The sibling point to measure from: Digha Gaon, the drop from the live test.
const ORIGIN = { lat: 19.1807634, lng: 72.99441899 }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// "Kalwa" previously put Kalwa, Haryana 179 km away at rank 1.
const QUERY = 'Kalwa'

console.log(`QUERY "${QUERY}"\n`)

console.log('--- via the oRPC handler, no origin (relevance order) ---')
const bare = await client.places.suggest({ q: QUERY })
for (const r of bare.results) {
  console.log(
    `  ${(r.label ?? '').padEnd(28)} distance=${String(r.distanceMeters)}`,
  )
}

await sleep(1200)

console.log(`\n--- via the oRPC handler, origin ${ORIGIN.lat}, ${ORIGIN.lng} ---`)
const anchored = await client.places.suggest({ q: QUERY, origin: ORIGIN })
for (const r of anchored.results) {
  const km = r.distanceMeters === null ? '-' : (r.distanceMeters / 1000).toFixed(2)
  console.log(
    `  ${(r.label ?? '').padEnd(28)} ${String(km).padStart(7)} km   ${(r.sublabel ?? '').slice(0, 60)}`,
  )
}

// The ordering guarantee, stated as an assertion rather than eyeballed.
const distances = anchored.results.map((r) => r.distanceMeters ?? 0)
const sorted = [...distances].sort((a, b) => a - b)
const ascending = distances.every((d, i) => d === sorted[i])
const allMeasured = anchored.results.every((r) => r.distanceMeters !== null)
const noneMeasured = bare.results.every((r) => r.distanceMeters === null)

console.log(`\nnearest-first ordering holds : ${ascending}`)
console.log(`every result has a distance  : ${allMeasured}`)
console.log(`no origin -> no distance     : ${noneMeasured}`)

const nearest = anchored.results[0]
console.log(
  `\nnearest: ${nearest.label} at ${(nearest.distanceMeters / 1000).toFixed(2)} km`,
)

// The lib is what the router wraps; check it agrees.
const direct = await suggestPlaces('Digha Gaon', ORIGIN)
console.log(
  `suggestPlaces direct: ${direct.length} results, nearest ${
    direct[0]?.distanceMeters
  } m`,
)




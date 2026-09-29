/**
 * Live check of places.reverse, which backs the "use my current location"
 * button: the browser supplies a lat/lng, this turns it into a readable label.
 */
import { createRouterClient } from '@orpc/server'
import router from '#/orpc/router'

const client = createRouterClient(router, {
  context: () => ({ headers: new Headers() }),
})

// A few places, including one with a named building so we can see the label
// pick the most specific component rather than the whole address.
const POINTS = [
  { name: 'Thane C Cabin (our default route)', lat: 19.187982, lng: 72.996397 },
  { name: 'Chhatrapati Shivaji Terminus', lat: 18.9402, lng: 72.835 },
  { name: 'Bengaluru MG Road', lat: 12.9756, lng: 77.6068 },
]

for (const p of POINTS) {
  process.stdout.write(`  ${p.name.padEnd(34)} -> `)
  try {
    const r = await client.places.reverse({ lat: p.lat, lng: p.lng })
    console.log(`${r.label}`)
    if (r.sublabel) console.log(`${' '.repeat(37)}${r.sublabel}`)
    console.log(
      `${' '.repeat(37)}coords kept: ${r.lat}, ${r.lng}  country=${r.country}`,
    )
  } catch (e) {
    console.log(`ERROR: ${e instanceof Error ? e.message : String(e)}`)
  }
  // Free tier is 2 requests/second.
  await new Promise((r) => setTimeout(r, 1200))
}

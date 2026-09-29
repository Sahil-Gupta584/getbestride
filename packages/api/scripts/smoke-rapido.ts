import { getRapidoFareEstimates } from '../src/lib/solari/rapido.js'

const ROUTES = [
  {
    name: 'Thane (route the browser originally used)',
    pickup: {
      lat: 19.187982,
      lng: 72.996397,
      displayName: 'Thane C Cabin',
      address: 'Thane C Cabin',
    },
    drop: {
      lat: 19.2369772,
      lng: 72.9666005,
      displayName: 'Tikuji-ni-Wadi',
      address: 'Tikuji-ni-Wadi',
    },
  },
  {
    name: 'Bengaluru Indiranagar -> Koramangala',
    pickup: {
      lat: 12.9716,
      lng: 77.5946,
      displayName: 'Indiranagar',
      address: 'Indiranagar',
    },
    drop: {
      lat: 12.9352,
      lng: 77.6245,
      displayName: 'Koramangala',
      address: 'Koramangala',
    },
  },
  {
    name: 'Delhi Connaught Place -> Hauz Khas',
    pickup: {
      lat: 28.6315,
      lng: 77.2167,
      displayName: 'Connaught Place',
      address: 'Connaught Place',
    },
    drop: {
      lat: 28.5494,
      lng: 77.2001,
      displayName: 'Hauz Khas',
      address: 'Hauz Khas',
    },
  },
]

for (const route of ROUTES) {
  process.stdout.write(`\n=== ${route.name} ===\n`)
  try {
    const t0 = Date.now()
    const fares = await getRapidoFareEstimates(route.pickup, route.drop)
    console.log(`  ${Date.now() - t0}ms, ${fares.length} service(s)`)
    for (const f of fares) {
      console.log(
        `    ${f.name.padEnd(16)} ₹${f.minFare} – ₹${f.maxFare}  [${f.id}]`,
      )
    }
    if (!fares.length)
      console.log('    (no fares decoded — parser may need a look)')
  } catch (e) {
    console.log(`  FAILED: ${e instanceof Error ? e.message : e}`)
  }
}

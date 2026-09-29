// Does a non-empty displayName change Rapido's protobuf response shape?
import { config } from 'dotenv'
config({ path: '.env' })
const { getRapidoFareEstimates } = await import('#/lib/scraper/rapido')

const base = { lat: 19.187982, lng: 72.996397 }
const dest = { lat: 19.1816178, lng: 72.9942152 }

const CASES = [
  { name: 'empty label (what smoke tests used)', pickup: '', drop: '' },
  { name: 'real labels (what the UI sends now)', pickup: 'Road To Shivaji Nagar', drop: 'Digha Railway Station Area' },
  { name: 'label only on pickup', pickup: 'Road To Shivaji Nagar', drop: '' },
]

for (const c of CASES) {
  const fares = await getRapidoFareEstimates(
    { ...base, displayName: c.pickup, address: '' },
    { ...dest, displayName: c.drop, address: '' },
  )
  console.log(`\n${c.name}`)
  console.log(`  -> ${fares.length} fares`)
  for (const f of fares) {
    console.log(`     ${f.serviceName.padEnd(16)} ${f.minFare}-${f.maxFare}  [${f.serviceType}]`)
  }
}

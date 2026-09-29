/**
 * Re-extract Rapido's signing assets from their published PWA bundles.
 *
 *   npm run sync:rapido          # verify vendored assets still match
 *   npm run sync:rapido -- --write   # re-download and overwrite
 *
 * The three files under src/lib/scraper/rapido/assets are lifted verbatim from
 * https://m.rapido.bike: the wasm and its JS shim are inlined in the main
 * Angular chunk, and the `@js-joda/core` dependency lives in the vendor chunk.
 * Rapido pins the first two with their own SHA-256 integrity check, so a digest
 * change means they shipped a new bundle.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ORIGIN = 'https://m.rapido.bike'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'

const OUT_DIR = fileURLToPath(
  new URL('./src/lib/scraper/rapido/assets/', import.meta.url),
)

const write = process.argv.includes('--write')

/** Digest of a JS string literal as Rapido's integrity check computes it. */
const sha256 = (data) => createHash('sha256').update(data).digest('hex')

/** Read a JS string literal starting at the quote at `start`, honouring escapes. */
function readStringLiteral(src, start) {
  const quote = src[start]
  if (quote !== '"' && quote !== "'" && quote !== '`') {
    throw new Error(`expected a string literal at offset ${start}`)
  }
  let out = ''
  let i = start + 1
  while (i < src.length) {
    const c = src[i]
    if (c === '\\') {
      const n = src[i + 1]
      if (n === 'n') out += '\n'
      else if (n === 't') out += '\t'
      else if (n === 'r') out += '\r'
      else if (n === 'u') {
        out += String.fromCharCode(parseInt(src.slice(i + 2, i + 6), 16))
        i += 6
        continue
      } else out += n
      i += 2
      continue
    }
    if (c === quote) return { value: out, end: i + 1 }
    out += c
    i++
  }
  throw new Error('unterminated string literal')
}

const get = async (url) => {
  const res = await fetch(url, { headers: { 'user-agent': UA } })
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`)
  return res.text()
}

console.log(`fetching ${ORIGIN}/ ...`)
const html = await get(`${ORIGIN}/`)

const scripts = new Set()
for (const m of html.matchAll(/(?:src|href)\s*=\s*["']([^"']+\.js)["']/gi)) {
  scripts.add(new URL(m[1], `${ORIGIN}/`).href)
}
if (!scripts.size) throw new Error('no JS assets found in HTML')

const bundles = new Map()
for (const url of scripts) {
  const text = await get(url)
  bundles.set(url, text)
}

const mainUrl = [...bundles.keys()].find((u) => /main-es2015/.test(u))
const vendorUrl = [...bundles.keys()].find((u) => /vendor-es2015/.test(u))
if (!mainUrl) throw new Error('main-es2015 chunk not found')
if (!vendorUrl) throw new Error('vendor-es2015 chunk not found')

const main = bundles.get(mainUrl)
const vendor = bundles.get(vendorUrl)
console.log(`  main   ${main.length} bytes`)
console.log(`  vendor ${vendor.length} bytes`)

// --- thiqa-glue.js : const Gi="..." in the main chunk ---------------------
const giAt = main.indexOf('const Gi="')
if (giAt < 0) throw new Error('`const Gi=` glue literal not found')
const glue = readStringLiteral(main, main.indexOf('"', giAt)).value

// --- thiqa.wasm : Uint8Array.from(atob("...")) in the main chunk ---------
const wasmAt = main.indexOf('Uint8Array.from(atob("')
if (wasmAt < 0) throw new Error('inlined wasm literal not found')
const wasmB64 = readStringLiteral(main, main.indexOf('"', wasmAt)).value
const wasm = Buffer.from(wasmB64, 'base64')
if (wasm.subarray(0, 4).toString('latin1') !== '\0asm') {
  throw new Error('inlined blob is not a wasm module')
}

// --- joda-core.js : ,PxaB:function(t,e,n){...} in the vendor chunk -------
const pxaAt = vendor.indexOf(',PxaB:function(')
if (pxaAt < 0) throw new Error('vendor module PxaB not found')
let depth = 0
let end = vendor.indexOf('{', pxaAt)
for (let i = end; i < vendor.length; i++) {
  if (vendor[i] === '{') depth++
  else if (vendor[i] === '}') {
    depth--
    if (depth === 0) {
      end = i
      break
    }
  }
}
const joda = vendor.slice(pxaAt + 1, end + 1)

// Rapido's own integrity pins for the first two, quoted from the interceptor.
const RAPIDO_PIN = {
  'thiqa-glue.js':
    '014a4bdd1be2c34142fd92063bedaff1b82ca7a3a823a9b81528496fb166d53b',
  'thiqa.wasm':
    '477c0bc399dc489b9b68ed2d1c86de7a2f4b3f271220a2d3e29e609c2dbae8b3',
}

const assets = {
  'thiqa-glue.js': Buffer.from(glue, 'utf8'),
  'thiqa.wasm': wasm,
  'joda-core.js': Buffer.from(joda, 'utf8'),
}

console.log('')
let drift = false
for (const [name, bytes] of Object.entries(assets)) {
  const digest = sha256(bytes)
  const path = OUT_DIR + name
  const current = existsSync(path) ? readFileSync(path) : null
  const currentDigest = current ? sha256(current) : null
  const status = currentDigest === digest ? 'unchanged' : 'CHANGED'
  if (status === 'CHANGED') drift = true

  let note = ''
  if (RAPIDO_PIN[name]) {
    note =
      digest === RAPIDO_PIN[name]
        ? '  [matches Rapido integrity pin]'
        : '  [WARN: differs from the pin quoted in their bundle]'
  }
  console.log(
    `${name.padEnd(15)} ${String(bytes.length).padStart(8)} B  ` +
      `sha256=${digest.slice(0, 16)}…  ${status}${note}`,
  )

  if (write) {
    writeFileSync(path, bytes)
    console.log(`${' '.repeat(16)}-> wrote ${path}`)
  }
}

if (drift) {
  console.log(
    '\nRapido has changed. Re-run with --write, then update EXPECTED_SHA256 in\n' +
      'src/lib/scraper/rapido/signer.ts to match the digests above.',
  )
  process.exitCode = 1
} else {
  console.log('\nAll vendored assets still match the live bundle.')
}

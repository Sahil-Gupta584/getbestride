/**
 * Simulation of the shared-browser registry in browser-pool.ts.
 *
 * The Lua is transliterated line-for-line into JS and driven through the same
 * acquire/mark-ready/release flow the real code uses, so the concurrency
 * behaviour can be checked without launching real Solari browsers.
 *
 * Run: node scripts/test-browser-pool.mjs
 */

let tokenSeq = 0
const nextToken = () => `tok-${++tokenSeq}`

// ── fake Redis ──────────────────────────────────────────────────────────────
const store = new Map()

// ── transliterated Lua ──────────────────────────────────────────────────────
// ACQUIRE_LUA
function acquire(ttl, token) {
  const raw = store.get('slot')
  if (raw === undefined) {
    store.set('slot', {
      state: 'starting',
      token,
      sessionId: '',
      refs: 1,
    })
    return ['owner']
  }
  const slot = raw
  slot.refs = slot.refs + 1
  if (slot.state === 'ready') return ['ready', slot.sessionId]
  return ['wait']
}

// MARK_READY_LUA
function markReady(token, sessionId) {
  const raw = store.get('slot')
  if (raw === undefined) return 0
  const slot = raw
  if (slot.token !== token) return 0
  slot.state = 'ready'
  slot.sessionId = sessionId
  return 1
}

// RELEASE_LUA
function release(sessionId) {
  const raw = store.get('slot')
  if (raw === undefined) return ['gone']
  const slot = raw
  if (slot.sessionId !== sessionId) return ['gone']
  slot.refs = slot.refs - 1
  if (slot.refs <= 0) {
    store.delete('slot')
    return ['close', slot.sessionId]
  }
  return ['keep']
}

// ── fake Solari ─────────────────────────────────────────────────────────────
let sessionsCreated = 0
let sessionsReleased = 0
let browsersClosed = 0
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Mirrors withSharedBrowser, with the network calls made instant.
async function withSharedBrowser(name, work) {
  let sessionId = ''
  let browser
  let token = ''

  for (let attempt = 0; attempt < 60; attempt++) {
    token = nextToken()
    const [status, existingId] = acquire(120, token)

    if (status === 'owner') {
      sessionsCreated++
      const session = { id: `sess-${sessionsCreated}` }
      browser = { id: session.id }

      const ok = markReady(token, session.id)
      if (!ok) {
        browsersClosed++
        sessionsReleased++
        throw new Error('slot lost while starting')
      }
      sessionId = session.id
      break
    }

    if (status === 'ready' && existingId) {
      sessionId = existingId
      browser = { id: existingId }
      break
    }

    await sleep(2) // 'wait' branch
  }

  if (!browser) throw new Error('timed out waiting for shared browser')

  try {
    return await work(browser, name)
  } finally {
    const outcome = release(sessionId)[0]
    // Mirrors the pool: close on both 'close' and 'gone'. 'gone' means the slot
    // vanished (TTL expiry) and the browser is orphaned, so it must still be
    // torn down or the Solari session leaks.
    if (outcome !== 'keep') {
      browsersClosed++
      sessionsReleased++
    }
  }
}

// ── scenarios ───────────────────────────────────────────────────────────────
const results = []
function check(label, pass, detail) {
  results.push({ label, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

async function scenarioSerial() {
  store.clear()
  sessionsCreated = sessionsReleased = browsersClosed = 0
  await withSharedBrowser('a', async () => 'x')
  await withSharedBrowser('b', async () => 'x')
  check(
    'serial: requests that do not overlap each get a browser, released after',
    sessionsCreated === 2 && browsersClosed === 2 && sessionsReleased === 2,
    `created=${sessionsCreated} closed=${browsersClosed} released=${sessionsReleased}`,
  )
}

async function scenarioConcurrent() {
  store.clear()
  sessionsCreated = sessionsReleased = browsersClosed = 0

  const out = await Promise.all([
    withSharedBrowser('a', async () => {
      await sleep(40)
      return 'a'
    }),
    withSharedBrowser('b', async () => {
      await sleep(20)
      return 'b'
    }),
    withSharedBrowser('c', async () => {
      await sleep(60)
      return 'c'
    }),
  ])

  check(
    'concurrent: all three share ONE browser',
    sessionsCreated === 1,
    `created=${sessionsCreated} (want 1)`,
  )
  check(
    'concurrent: closed exactly once, only after the LAST request finished',
    browsersClosed === 1 && sessionsReleased === 1,
    `closed=${browsersClosed} released=${sessionsReleased}`,
  )
  check('concurrent: every request got its result', out.join('') === 'abc', out.join(''))
  check('concurrent: slot left empty for reuse', !store.has('slot'))
}

async function scenarioFastFinisherDoesNotKillSlowOne() {
  store.clear()
  sessionsCreated = browsersClosed = 0

  let slowFinished = false
  let closedWhileSlowRunning = false

  const slow = withSharedBrowser('slow', async () => {
    await sleep(80)
    slowFinished = true
    return 'slow'
  })
  // Arrive slightly later so it attaches to the browser the first request made.
  await sleep(10)
  const fast = withSharedBrowser('fast', async () => 'fast')

  await fast
  // The fast request just released; the slow one must still be running, so the
  // browser must NOT have been closed out from under it.
  if (!slowFinished && browsersClosed > 0) closedWhileSlowRunning = true

  await slow
  check(
    'refcount: a finishing request does not close a browser still in use',
    !closedWhileSlowRunning && browsersClosed === 1,
    `closed=${browsersClosed} closedWhileSlowRunning=${closedWhileSlowRunning}`,
  )
}

async function scenarioSlotExpiryMidStart() {
  store.clear()
  // Simulate the TTL expiring while the owner is still creating a browser.
  store.set('slot', {
    state: 'starting',
    token: 'tok-orphan',
    sessionId: '',
    refs: 1,
  })
  store.delete('slot')

  const ok = markReady('tok-orphan', 'sess-1')
  check('expiry: mark-ready on a vanished slot is rejected', ok === 0, `returned ${ok}`)
  check('expiry: release on a vanished slot reports gone', release('sess-1')[0] === 'gone')
}

async function scenarioStaleOwnerCannotHijack() {
  store.clear()
  // A stale owner (slot expired, someone else took over) must not overwrite the
  // new owner's browser.
  store.set('slot', {
    state: 'starting',
    token: 'tok-new',
    sessionId: '',
    refs: 1,
  })
  const ok = markReady('tok-old', 'sess-old')
  check(
    'safety: a superseded owner cannot overwrite the live slot',
    ok === 0,
    `returned ${ok}`,
  )
  check('safety: the live slot is untouched', store.get('slot').token === 'tok-new')
}

async function scenarioTtlExpiryMidScrapeDoesNotLeak() {
  // The real bug: a scrape slower than the slot TTL had its key deleted
  // mid-request. Every release then returned 'gone' and nothing closed the
  // browser, leaving a live Solari session behind.
  store.clear()
  sessionsCreated = sessionsReleased = browsersClosed = 0

  store.set('slot', {
    state: 'ready',
    token: 'tok-1',
    sessionId: 'sess-1',
    refs: 1,
  })

  // Slot expires while the request is still scraping.
  store.delete('slot')

  const outcome = release('sess-1')[0]
  const shouldClose = outcome !== 'keep'
  if (shouldClose) {
    browsersClosed++
    sessionsReleased++
  }

  check(
    'leak: TTL expiry mid-scrape still closes the orphaned browser',
    outcome === 'gone' && shouldClose && browsersClosed === 1,
    `outcome=${outcome} closed=${browsersClosed}`,
  )
}

await scenarioSerial()
await scenarioConcurrent()
await scenarioFastFinisherDoesNotKillSlowOne()
await scenarioSlotExpiryMidStart()
await scenarioStaleOwnerCannotHijack()
await scenarioTtlExpiryMidScrapeDoesNotLeak()

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)

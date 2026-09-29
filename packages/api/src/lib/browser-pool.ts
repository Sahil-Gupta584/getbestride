import { randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";
import { Solari } from "@solarisdk/browser";
import type { BrowserSession } from "@solarisdk/browser";
import type { Page } from "patchright-core";
import { env } from "../env.js";

const SLOT_KEY = "getbestride:browser:slot";
/**
 * Ledger of Solari sessions this process launched and has not yet released.
 * A hash (sessionId -> "launchedAt:attempts") rather than a set, so the reaper
 * can ignore young sessions and bound its retries. Redis outlives the process,
 * which is the whole point: a crash leaves the record, not a ghost.
 */
const LAUNCHED_KEY = "getbestride:browser:launched";
const SLOT_TTL_SECONDS = 120;
const HEARTBEAT_INTERVAL_MS = 30000;
const SWEEP_INTERVAL_MS = 60000;
/** Teardown finishes ~20s after the slot dies; younger sessions are in flight. */
const SWEEP_MIN_AGE_MS = 180000;
const SWEEP_MAX_ATTEMPTS = 3;

const ACQUIRE_LUA = `
local raw = redis.call('GET', KEYS[1])
if not raw then
  local fresh = cjson.encode({ state = 'starting', token = ARGV[2], sessionId = '', refs = 1 })
  redis.call('SET', KEYS[1], fresh, 'EX', tonumber(ARGV[1]))
  return { 'owner' }
end
local slot = cjson.decode(raw)
slot.refs = slot.refs + 1
redis.call('SET', KEYS[1], cjson.encode(slot), 'EX', tonumber(ARGV[1]))
if slot.state == 'ready' then
  return { 'ready', slot.sessionId }
end
return { 'wait' }
`;

const MARK_READY_LUA = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local slot = cjson.decode(raw)
if slot.token ~= ARGV[1] then return 0 end
slot.state = 'ready'
slot.sessionId = ARGV[2]
redis.call('SET', KEYS[1], cjson.encode(slot), 'EX', tonumber(ARGV[3]))
return 1
`;

const RELEASE_LUA = `
local raw = redis.call('GET', KEYS[1])
if not raw then return { 'gone' } end
local slot = cjson.decode(raw)
if slot.sessionId ~= ARGV[1] then return { 'gone' } end
slot.refs = slot.refs - 1
if slot.refs <= 0 then
  redis.call('DEL', KEYS[1])
  return { 'close', slot.sessionId }
end
redis.call('SET', KEYS[1], cjson.encode(slot), 'EX', tonumber(ARGV[2]))
return { 'keep' }
`;

const HEARTBEAT_LUA = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local slot = cjson.decode(raw)
if slot.sessionId ~= ARGV[1] then return 0 end
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
return 1
`;

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

const browsers = new Map<string, BrowserSession>();

async function acquire(token: string): Promise<[string, string?]> {
  const result = (await redis.eval(
    ACQUIRE_LUA,
    [SLOT_KEY],
    [SLOT_TTL_SECONDS, token],
  )) as string[];
  return [result[0] as string, result[1] as string | undefined];
}

async function markReady(token: string, sessionId: string): Promise<boolean> {
  const ok = await redis.eval(
    MARK_READY_LUA,
    [SLOT_KEY],
    [token, sessionId, SLOT_TTL_SECONDS],
  );
  return ok === 1;
}

async function release(sessionId: string): Promise<"close" | "keep" | "gone"> {
  const result = (await redis.eval(
    RELEASE_LUA,
    [SLOT_KEY],
    [sessionId, SLOT_TTL_SECONDS],
  )) as string[];
  return (result[0] as "close" | "keep" | "gone") ?? "gone";
}

function startHeartbeat(sessionId: string): () => void {
  const timer = setInterval(() => {
    redis
      .eval(HEARTBEAT_LUA, [SLOT_KEY], [sessionId, SLOT_TTL_SECONDS])
      .catch((cause) => console.warn("[browser-pool] heartbeat failed", cause));
  }, HEARTBEAT_INTERVAL_MS);
  timer.unref?.();
  return () => clearInterval(timer);
}

const READY_POLL_INTERVAL_MS = 400;
const READY_POLL_ATTEMPTS = 60;

/**
 * Upper bound for the CDP close of a remote browser.
 *
 * `BrowserSession.close()` issues the Solari DELETE only *after* that CDP call
 * resolves, so a hung close strands the session: Solari keeps it Running, the
 * pool slot stays held, and our Redis refcount is already gone. The budget
 * turns a hang into a fallthrough to an explicit release below.
 */
const CLOSE_BUDGET_MS = 5000;

/** Upper bound for the DELETE that actually ends the session. */
const RELEASE_BUDGET_MS = 15000;

function withBudget<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  // An abandoned loser must not surface later as an unhandled rejection.
  promise.catch(() => {});
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`exceeded ${ms}ms`)), ms);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function trackLaunched(sessionId: string): Promise<void> {
  await redis
    .hset(LAUNCHED_KEY, { [sessionId]: `${Date.now()}:0` })
    .catch(() => {});
}

async function forgetLaunched(sessionId: string): Promise<void> {
  await redis.hdel(LAUNCHED_KEY, sessionId).catch(() => {});
}

let reaperStarted = false;
let sweeping = false;

/**
 * Collect sessions whose release never landed — process crash, slot TTL expiry
 * while a scrape was in flight, or a release that kept failing. Anything in the
 * ledger that is neither the live slot's session nor younger than the teardown
 * window is a stranded browser still billing for its pool slot.
 */
function startReaper(): void {
  if (reaperStarted) return;
  reaperStarted = true;
  runSweep();
  const timer = setInterval(runSweep, SWEEP_INTERVAL_MS);
  timer.unref?.();
}

const runSweep = (): void => {
  void sweepStranded().catch((cause) => {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.error(`[browser-pool] reaper sweep failed: ${message}`);
  });
};

async function sweepStranded(): Promise<void> {
  if (sweeping) return;
  sweeping = true;
  try {
    const launched = await redis
      .hgetall<Record<string, string>>(LAUNCHED_KEY)
      .catch(() => null);
    if (!launched || Object.keys(launched).length === 0) return;

    const slot = await redis
      .get<{ state?: string; sessionId?: string }>(SLOT_KEY)
      .catch(() => null);
    if (slot?.state === "starting") return; // a launch is in flight

    const sweeper = new Solari({
      apiKey: env.SOLARI_API_KEY,
      baseUrl: "https://api.getsolari.com",
    });
    try {
      for (const [sessionId, raw] of Object.entries(launched)) {
        if (sessionId === slot?.sessionId) continue; // still the shared browser

        const [launchedAtRaw, attemptsRaw] = String(raw).split(":");
        const launchedAt = Number(launchedAtRaw);
        const attempts = Number(attemptsRaw ?? 0);
        const age = Date.now() - launchedAt;
        if (Number.isFinite(age) && age >= 0 && age < SWEEP_MIN_AGE_MS) {
          continue; // teardown may still be mid-flight
        }

        try {
          await withBudget(
            sweeper.sessions.releaseAndWait(sessionId),
            RELEASE_BUDGET_MS,
          );
          await forgetLaunched(sessionId);
        } catch (cause) {
          const message =
            cause instanceof Error ? cause.message : String(cause);
          if (attempts + 1 >= SWEEP_MAX_ATTEMPTS) {
            await forgetLaunched(sessionId);
            console.error(
              `[browser-pool] gave up releasing stranded session ${sessionId.slice(0, 8)}… ` +
                `after ${SWEEP_MAX_ATTEMPTS} attempts: ${message}`,
            );
          } else {
            await redis
              .hset(LAUNCHED_KEY, {
                [sessionId]: `${launchedAt || Date.now()}:${attempts + 1}`,
              })
              .catch(() => {});
            console.error(
              `[browser-pool] reaper could not release ${sessionId.slice(0, 8)}… ` +
                `(attempt ${attempts + 1}/${SWEEP_MAX_ATTEMPTS}): ${message}`,
            );
          }
        }
      }
    } finally {
      await sweeper.close().catch(() => {});
    }
  } finally {
    sweeping = false;
  }
}

async function teardown(
  solari: Solari,
  browser: BrowserSession | undefined,
  sessionId: string,
): Promise<void> {
  if (!browser) {
    // Shared browser stays up for the other in-flight requests; only the
    // per-request client goes away.
    await solari.close().catch(() => {});
    return;
  }

  let stage = "close browser";
  try {
    let closed = false;
    await withBudget(browser.close(), CLOSE_BUDGET_MS).then(
      () => {
        closed = true;
      },
      () => {
        // Hung or rejected — fall through to an explicit release.
      },
    );
    if (!closed) {
      stage = "release session";
      await withBudget(
        solari.sessions.releaseAndWait(sessionId),
        RELEASE_BUDGET_MS,
      );
    }
    await forgetLaunched(sessionId);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.error(
      `[browser-pool] teardown failed at "${stage}": ${message} ` +
        `(session ${sessionId.slice(0, 8)}…; pool slot still held, reaper retries)`,
    );
  } finally {
    await solari.close().catch(() => {});
  }
}

export async function withSharedBrowser<T>(
  fn: (page: Page) => Promise<T>,
): Promise<T> {
  startReaper();
  const solari = new Solari({
    apiKey: env.SOLARI_API_KEY,
    baseUrl: "https://api.getsolari.com",
  });

  let sessionId = "";
  let browser: BrowserSession | undefined;
  let token = "";

  for (let attempt = 0; attempt < READY_POLL_ATTEMPTS; attempt++) {
    token = randomUUID();
    const [status, existingSessionId] = await acquire(token);

    if (status === "owner") {
      const launched = await solari.launch({
        stealth: true,
        captcha: true,
        recording: true,
        profileId: env.SOLARI_PROFILE_ID,
        proxy: { country: "in" },
      });
      await trackLaunched(launched.id);

      const published = await markReady(token, launched.id);
      if (!published) {
        await launched.close().catch(() => {});
        await forgetLaunched(launched.id);
        throw new Error(
          "Shared browser slot was lost while starting the browser",
        );
      }
      sessionId = launched.id;
      browser = launched;
      browsers.set(sessionId, launched);
      break;
    }

    if (status === "ready" && existingSessionId) {
      const attached = browsers.get(existingSessionId);
      if (attached) {
        sessionId = existingSessionId;
        browser = attached;
        break;
      }
      // Slot says ready but this process has no handle: it died and restarted
      // (or a peer did) while the remote session kept running. Drop the slot
      // and detach a DELETE so the next attempt launches a clean browser;
      // the reaper catches this if the DELETE never lands.
      const orphan = await release(existingSessionId);
      if (orphan === "close") {
        void withBudget(
          solari.sessions.releaseAndWait(existingSessionId),
          RELEASE_BUDGET_MS,
        )
          .then(() => forgetLaunched(existingSessionId))
          .catch(() => {});
      }
      continue;
    }

    await new Promise((r) => setTimeout(r, READY_POLL_INTERVAL_MS));
  }

  if (!browser || !sessionId) {
    throw new Error(
      `Timed out waiting for a shared browser after ~${(READY_POLL_ATTEMPTS * READY_POLL_INTERVAL_MS) / 1000}s`,
    );
  }

  const stopHeartbeat = startHeartbeat(sessionId);

  try {
    const page = await browser.newPage();
    try {
      return await fn(page);
    } finally {
      await page.close().catch(() => {});
    }
  } finally {
    stopHeartbeat();
    const outcome = await release(sessionId);

    // Detached teardown. The refcount above is already settled; everything
    // below must never delay the response. A hung browser close used to hold
    // the slowest provider's already-computed fares hostage (infinite
    // skeleton), so close failures are logged, never thrown.
    const closing = outcome !== "keep" ? browser : undefined;
    if (closing) browsers.delete(sessionId);
    void teardown(solari, closing, sessionId);
  }
}

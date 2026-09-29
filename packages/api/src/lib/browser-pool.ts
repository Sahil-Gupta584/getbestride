import { randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";
import { Solari } from "@solarisdk/browser";
import type { BrowserSession } from "@solarisdk/browser";
import type { Page } from "patchright-core";
import { env } from "../env.js";

const SLOT_KEY = "getbestride:browser:slot";
const SLOT_TTL_SECONDS = 120;
const HEARTBEAT_INTERVAL_MS = 30000;

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
  const ok = await redis.eval(MARK_READY_LUA, [SLOT_KEY], [
    token,
    sessionId,
    SLOT_TTL_SECONDS,
  ]);
  return ok === 1;
}

async function release(sessionId: string): Promise<"close" | "keep" | "gone"> {
  const result = (await redis.eval(RELEASE_LUA, [SLOT_KEY], [
    sessionId,
    SLOT_TTL_SECONDS,
  ])) as string[];
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
 * Upper bound for closing the browser and releasing the session.
 *
 * Teardown runs detached from the response (see below), so this only decides
 * how long a stuck close is given before it is logged and abandoned. The
 * session auto-releases server-side anyway.
 */
const TEARDOWN_TIMEOUT_MS = 15000;

async function teardown(
  solari: Solari,
  browser: BrowserSession | undefined,
  sessionId: string,
): Promise<void> {
  const work = (async () => {
    if (browser) {
      await browser.close().catch(() => {});
      await solari.sessions.releaseAndWait(sessionId).catch(() => {});
    }
    await solari.close().catch(() => {});
  })();

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      work,
      new Promise<never>(
        (_, reject) =>
          (timer = setTimeout(
            () =>
              reject(
                new Error(`teardown timed out after ${TEARDOWN_TIMEOUT_MS}ms`),
              ),
            TEARDOWN_TIMEOUT_MS,
          )),
      ),
    ]);
  } catch (cause) {
    console.error(
      `[browser-pool] background teardown of ${sessionId} failed:`,
      cause,
    );
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function withSharedBrowser<T>(
  fn: (page: Page) => Promise<T>,
): Promise<T> {
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

      const published = await markReady(token, launched.id);
      if (!published) {
        await launched.close().catch(() => {});
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
      await release(existingSessionId);
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

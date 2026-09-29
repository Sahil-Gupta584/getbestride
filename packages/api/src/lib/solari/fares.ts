import type { Page } from "patchright-core";
export const PAGE_TIMEOUT_MS = 45000;
const FETCH_TIMEOUT_MS = 30000;
export interface LatLng {
  lat: number;
  lng: number;
  label?: string;
}
export interface RawFare {
  id: string;
  name: string;
  minFare: number;
  maxFare: number;
}
export async function evaluateJson<T>(
  page: Page,
  label: string,
  request: {
    url: string;
    method: "GET" | "POST";
    headers?: Record<string, string>;
    body?: string;
  },
): Promise<T> {
  const started = Date.now();
  let result: {
    status: number;
    ok: boolean;
    body: string;
  };
  try {
    result = await page.evaluate(
      async (req) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), req.timeoutMs);
        try {
          const res = await fetch(req.url, {
            method: req.method,
            credentials: "include",
            headers: req.headers ?? {},
            body: req.body,
            signal: controller.signal,
          });
          return { status: res.status, ok: res.ok, body: await res.text() };
        } catch (cause) {
          throw new Error(
            `in-page fetch to ${req.url} failed: ${cause instanceof Error ? cause.message : String(cause)}`,
          );
        } finally {
          clearTimeout(timer);
        }
      },
      { ...request, timeoutMs: FETCH_TIMEOUT_MS },
    );
  } catch (cause) {
    console.error(
      `[${label}] page.evaluate threw after ${Date.now() - started}ms`,
      cause,
    );
    throw new Error(
      `${label}: in-page request never returned (${cause instanceof Error ? cause.message : String(cause)})`,
    );
  }
  const elapsed = Date.now() - started;
  if (!result.ok) {
    console.error(
      `[${label}] ${request.method} ${request.url} -> HTTP ${result.status} in ${elapsed}ms: ${result.body.slice(0, 300)}`,
    );
    throw new Error(`${label}: HTTP ${result.status} from ${request.url}`);
  }
  let parsed: T;
  try {
    parsed = JSON.parse(result.body) as T;
  } catch {
    console.error(
      `[${label}] ${request.url} returned non-JSON after ${elapsed}ms: ${result.body.slice(0, 300)}`,
    );
    throw new Error(
      `${label}: expected JSON from ${request.url}, got ${result.body.slice(0, 120)}`,
    );
  }
  return parsed;
}

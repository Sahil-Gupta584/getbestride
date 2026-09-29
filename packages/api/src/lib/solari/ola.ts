import { withSharedBrowser } from "../browser-pool.js";
import {
  evaluateJson,
  PAGE_TIMEOUT_MS,
  type LatLng,
  type RawFare,
} from "./fares.js";
const ORIGIN = "https://book.olacabs.com/";
const FARE_URL = "https://book.olacabs.com/data-api/category-fare/p2p";
const AVAILABILITY_URL =
  "https://book.olacabs.com/data-api/category-availability/p2p";
interface CategoryFareResponse {
  data?: {
    p2p?: {
      categories?: Record<
        string,
        {
          price?: string | null;
        }
      >;
    };
  } | null;
  error?: {
    code?: string;
    message?: string;
  } | null;
}
interface AvailabilityResponse {
  data?: {
    p2p?: {
      categories?: {
        id: string;
        displayName?: string | null;
        eta?: {
          value?: number | null;
        } | null;
      }[];
    };
  } | null;
  error?: {
    code?: string;
    message?: string;
  } | null;
}
function parsePrice(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d.]/g, "");
  if (!digits) return null;
  const n = Number.parseFloat(digits);
  return Number.isFinite(n) ? Math.round(n) : null;
}
function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function toQuery(pickup: LatLng, drop: LatLng, silent: boolean): string {
  return new URLSearchParams({
    pickupLat: String(pickup.lat),
    pickupLng: String(pickup.lng),
    pickupMode: "NOW",
    leadSource: "desktop_website",
    dropLat: String(drop.lat),
    dropLng: String(drop.lng),
    silent: String(silent),
    ...(silent ? {} : { suggestPickup: "true" }),
  }).toString();
}
export async function getOlaFareEstimates(
  pickup: LatLng,
  drop: LatLng,
): Promise<RawFare[]> {
  return withSharedBrowser(async (page) => {
    page.setDefaultTimeout(PAGE_TIMEOUT_MS);
    page.setDefaultNavigationTimeout(PAGE_TIMEOUT_MS);
    await page.goto(ORIGIN, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT_MS });
    const availability = evaluateJson<AvailabilityResponse>(
      page,
      "ola/availability",
      {
        url: `${AVAILABILITY_URL}?${toQuery(pickup, drop, true)}`,
        method: "GET",
        headers: {
          accept: "application/json",
          "x-requested-with": "XMLHttpRequest",
        },
      },
    ).catch((cause) => {
      console.warn("[ola/availability] failed, continuing without ETAs", cause);
      return null;
    });
    const fareJson = await evaluateJson<CategoryFareResponse>(
      page,
      "ola/fares",
      {
        url: `${FARE_URL}?${toQuery(pickup, drop, false)}`,
        method: "GET",
        headers: { accept: "application/json" },
      },
    );
    if (fareJson.error) {
      throw new Error(
        `Ola API error: ${fareJson.error.message ?? "unknown"} [${fareJson.error.code}]`,
      );
    }
    const categories = fareJson.data?.p2p?.categories ?? {};
    if (Object.keys(categories).length === 0) {
      console.warn(
        `[ola/fares] request succeeded but returned no categories (url=${FARE_URL})`,
      );
    }
    const availabilityJson = await availability;
    const meta = new Map<
      string,
      {
        displayName?: string | null;
      }
    >();
    if (availabilityJson && !availabilityJson.error) {
      for (const c of availabilityJson.data?.p2p?.categories ?? []) {
        meta.set(c.id, { displayName: c.displayName });
      }
    }
    const fares: RawFare[] = [];
    for (const [categoryId, entry] of Object.entries(categories)) {
      const fare = parsePrice(entry.price);
      if (fare === null || fare <= 0) continue;
      fares.push({
        id: categoryId,
        name: meta.get(categoryId)?.displayName || titleCase(categoryId),
        minFare: fare,
        maxFare: fare,
      });
    }
    return fares;
  });
}

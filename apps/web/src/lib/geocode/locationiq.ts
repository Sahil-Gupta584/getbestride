import { env } from '#/env'

/**
 * LocationIQ geocoding, used for the pickup/drop typeahead.
 *
 * Docs: https://docs.locationiq.com/docs/autocomplete-api
 *       https://docs.locationiq.com/docs/reverse-geocoding
 *
 * The Autocomplete endpoint returns `lat`/`lon` on every suggestion, so it also
 * serves as the forward geocoder: selecting a row is a single billed request and
 * there is no second resolve call. The docs explicitly say Autocomplete is not a
 * drop-in replacement for the Search endpoint, so we never re-geocode the text the
 * user typed — we take the coordinates of the row they actually picked.
 *
 * Reverse geocoding covers the "use my current location" button, which gets bare
 * coordinates from the browser's Geolocation API and needs a readable label.
 *
 * Free-tier limits, from https://locationiq.com/pricing:
 *   - 5,000 requests/day, 2 requests/second, 60 requests/minute
 *   - Commercial use requires a visible link back to locationiq.com
 *   - Responses may be cached for up to 48 hours
 * The 2 req/sec cap is why the UI debounces before calling in.
 */

const AUTOCOMPLETE_URL = 'https://api.locationiq.com/v1/autocomplete'
const REVERSE_URL = 'https://api.locationiq.com/v1/reverse'

/** Below this the API returns nothing useful, so don't spend a request. */
export const MIN_QUERY_LENGTH = 3

export interface PlaceSuggestion {
  lat: number
  lng: number
  /** Name only, e.g. "Empire State Building". Bold line in the dropdown. */
  label: string
  /** Remainder of the address. Grey subline in the dropdown. */
  sublabel: string
  /** Country the result resolved to, for sanity-checking cross-border hits. */
  country: string
  /**
   * Metres from the `origin` this was requested with, or `null` when no origin
   * was supplied. Drives both the distance column in the dropdown and the
   * nearest-first ordering, which is what stops a same-named place in another
   * state outranking the one the user meant.
   */
  distanceMeters: number | null
}

/** A point to measure suggestions from — usually the other form field. */
export interface GeoOrigin {
  lat: number
  lng: number
}

/**
 * Great-circle distance in metres.
 *
 * Exported because the quotes page shows the same measurement between the two
 * chosen points once a route is complete. Note this is as-the-crow-flies, not
 * road distance: it is a sanity check on the route the user picked, not the
 * basis the ride platforms actually price on.
 */
export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Shape of the fields we read. Everything else in the response is ignored. */
interface LocationIQResult {
  lat?: string
  lon?: string
  display_place?: string
  display_address?: string
  display_name?: string
  address?: { name?: string; country?: string }
}

function requireToken(): string {
  return env.LOCATIONIQ_TOKEN
}

/**
 * Typeahead suggestions for a partial address.
 *
 * When `origin` is given, every suggestion carries its distance from there and
 * the list comes back nearest-first. Autocomplete ranks by text similarity
 * alone, so "Kalwa" returns Kalwa in Haryana ahead of Kalwa in Thane; measuring
 * against the sibling field turns that into a useful ordering.
 *
 * Returns an empty array for queries too short to be worth a request. Throws on
 * missing configuration or a non-2xx response so the caller can distinguish
 * "no matches" from "the API is unhappy".
 */
export async function suggestPlaces(
  query: string,
  origin?: GeoOrigin | null,
): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim()
  if (trimmed.length < MIN_QUERY_LENGTH) return []

  const params = new URLSearchParams({
    key: requireToken(),
    q: trimmed.slice(0, 200), // docs cap q at 200 chars
    limit: '8', // docs allow 1..20; 8 is plenty for a dropdown
    countrycodes: 'in',
    'accept-language': 'en',
  })

  const res = await fetch(`${AUTOCOMPLETE_URL}?${params}`)

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    // 429 is the free tier's 2 req/sec or daily cap being hit.
    if (res.status === 429) {
      throw new Error(
        'LocationIQ rate limit reached. Free tier allows 2 requests/second and 5,000/day.',
      )
    }
    throw new Error(
      `LocationIQ autocomplete failed (${res.status} ${res.statusText})${
        body ? `: ${body.slice(0, 200)}` : ''
      }`,
    )
  }

  const json: unknown = await res.json().catch(() => null)
  // On some failures the API returns an object rather than the documented array.
  if (!Array.isArray(json)) return []

  const results: PlaceSuggestion[] = []
  for (const raw of json as LocationIQResult[]) {
    // lat/lon arrive as strings; skip anything we can't parse rather than
    // handing NaN coordinates to the scrapers.
    const lat = Number.parseFloat(raw.lat ?? '')
    const lng = Number.parseFloat(raw.lon ?? '')
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue

    const label =
      raw.display_place || raw.address?.name || raw.display_name || ''
    if (!label) continue

    results.push({
      lat,
      lng,
      label,
      sublabel: raw.display_address ?? raw.display_name ?? '',
      country: raw.address?.country ?? '',
      distanceMeters: origin
        ? Math.round(distanceMeters(origin, { lat, lng }))
        : null,
    })
  }

  // Nearest-first when we know where the user is working from. Ties keep the
  // API's own relevance order, since Array.prototype.sort is stable.
  if (origin) {
    results.sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0))
  }

  return results
}

/** The parts of the reverse-geocode response we read. */
interface LocationIQReverseResult {
  display_name?: string
  address?: {
    name?: string
    road?: string
    suburb?: string
    city_district?: string
    city?: string
    town?: string
    state?: string
    country?: string
  }
}

/**
 * Turn coordinates into a readable label. Backs the "use my current location"
 * shortcut, where the browser's Geolocation API gives us a lat/lng and nothing
 * else.
 *
 * `format=json` is required — this endpoint defaults to XML.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<PlaceSuggestion> {
  const params = new URLSearchParams({
    key: env.LOCATIONIQ_TOKEN,
    lat: String(lat),
    lon: String(lng),
    format: 'json',
  })

  const res = await fetch(`${REVERSE_URL}?${params}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    if (res.status === 429) {
      throw new Error('LocationIQ rate limit reached. Try again in a moment.')
    }
    throw new Error(
      `LocationIQ reverse geocode failed (${res.status} ${res.statusText})${
        body ? `: ${body.slice(0, 200)}` : ''
      }`,
    )
  }

  const raw = (await res
    .json()
    .catch(() => null)) as LocationIQReverseResult | null
  const full = raw?.display_name ?? ''
  if (!raw || !full) {
    throw new Error('Could not resolve those coordinates to an address.')
  }

  // Prefer the most specific component for the bold label; the rest of
  // display_name becomes the subline so the two-line shape is preserved.
  const a = raw.address ?? {}
  const label =
    a.name || a.road || a.suburb || a.city_district || a.city || a.town || full
  const remainder = full.startsWith(label)
    ? full.slice(label.length).replace(/^,\s*/, '')
    : ''

  return {
    // Trust the browser's coordinates over the echoed ones so the pin sits
    // exactly where the user is.
    lat,
    lng,
    label,
    sublabel: remainder,
    country: a.country ?? '',
    // Nothing to measure against: a reverse geocode is a point, not a search.
    distanceMeters: null,
  }
}

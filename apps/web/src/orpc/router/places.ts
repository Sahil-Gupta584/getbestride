import { z } from 'zod'
import {
  suggestPlaces,
  reverseGeocode,
  MIN_QUERY_LENGTH,
} from '#/lib/geocode/locationiq'
import { base } from '#/orpc/middleware'

/**
 * Address lookup for the pickup/drop inputs.
 *
 * Wraps LocationIQ so the API key stays server-side — the browser only ever
 * talks to our own oRPC endpoints.
 */
export const suggest = base
  .input(
    z.object({
      q: z.string().max(200),
      /**
       * The other form field, so results can be measured and ordered against it.
       * Absent when the sibling field is still empty — the first field the user
       * fills in has nothing to sort against, so results stay in relevance order.
       */
      origin: z
        .object({
          lat: z.number().min(-90).max(90),
          lng: z.number().min(-180).max(180),
        })
        .nullish(),
    }),
  )
  .handler(async ({ input }) => {
    const results = await suggestPlaces(input.q, input.origin ?? null)
    return {
      query: input.q,
      // Lets the UI skip its own length check without duplicating the constant.
      minLength: MIN_QUERY_LENGTH,
      results,
    }
  })

/**
 * Coordinates to a readable label. Backs the "use my current location" button,
 * where the browser's Geolocation API returns a lat/lng and nothing else.
 */
export const reverse = base
  .input(
    z.object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    }),
  )
  .handler(async ({ input }) => {
    return reverseGeocode(input.lat, input.lng)
  })

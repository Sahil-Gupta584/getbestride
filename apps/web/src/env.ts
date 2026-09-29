import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    BETTER_AUTH_SECRET: z.string().min(1),
    RESEND_API_KEY: z.string().min(1),

    // LocationIQ powers the pickup/drop address autocomplete. Free tier is
    // 5,000 requests/day at 2 requests/second, and commercial use requires a
    // visible link back to locationiq.com (rendered in the UI).
    // Sign up at https://my.locationiq.com/register — the token is the `pk.…`
    // part on its own, without the `locationiq:` prefix.
    LOCATIONIQ_TOKEN: z.string().min(1),

    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),

    DODO_PAYMENTS_API_KEY: z.string().optional(),
    DODO_PAYMENTS_WEBHOOK_KEY: z.string().optional(),
    DODO_PAYMENTS_ENVIRONMENT: z
      .enum(['test_mode', 'live_mode'])
      .default('test_mode'),
    SENTRY_AUTH_TOKEN: z.string().min(1).optional(),
    NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
  },

  clientPrefix: 'VITE_',

  client: {
    // The app's own origin (better-auth baseURL). Prefixed so it reaches the
    // browser too — absolute SEO URLs (og:image, canonical) need it in head meta.
    VITE_BETTER_AUTH_URL: z.string().url(),
    VITE_SENTRY_DSN: z.string().url().optional(),
    VITE_SENTRY_ORG: z.string().optional(),
    VITE_SENTRY_PROJECT: z.string().optional(),
    // Where the browser reaches the quotes API (POST {VITE_BACKEND_URL}/rpc).
    // Public by design: there is no secret, quotes will become authed procedures.
    VITE_BACKEND_URL: z.string().url().default('http://localhost:4000'),
    // Mirrors whether GOOGLE_CLIENT_ID/SECRET are configured server-side, so the
    // UI can hide the Google button instead of offering a dead one. Set to any
    // non-empty value (e.g. VITE_GOOGLE_AUTH_ENABLED=true) when Google is on.
    VITE_GOOGLE_AUTH_ENABLED: z.string().optional(),
  },

  runtimeEnv: {
    ...import.meta.env,
    ...process.env,
  },

  emptyStringAsUndefined: true,
})

import { env } from '#/env'

/**
 * Public origin of this app, e.g. `https://getbestride.vercel.app` (no
 * trailing slash). Used for absolute SEO URLs — crawlers reject relative
 * paths in og:image / og:url / canonical.
 *
 * Read from `VITE_BETTER_AUTH_URL`, which is client-safe (VITE_ prefix), so
 * `head()` can run unchanged during SSR and client navigation.
 */
export const SITE_URL = env.VITE_BETTER_AUTH_URL.replace(/\/+$/, '')

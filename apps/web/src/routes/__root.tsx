import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import appCss from '../styles.css?url'

import { SITE_URL } from '#/lib/site-url'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

const TITLE = 'GetBestRide — Compare Ride Fares Across Uber, Rapido & Ola'
const DESCRIPTION =
  'Compare real-time ride fares across Uber, Rapido, and Ola side by side. Find the cheapest bike, auto, and cab rides for your route instantly.'
const CANONICAL = `${SITE_URL}/`
const SOCIAL_IMAGE = `${SITE_URL}/og.png`

export const Route = createRootRouteWithContext<MyRouterContext>()({
  notFoundComponent: () => (
    <div className="flex h-screen items-center justify-center font-sans text-lg text-gray-600">
      Page Not Found
    </div>
  ),
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: TITLE,
      },
      {
        name: 'description',
        content: DESCRIPTION,
      },
      {
        name: 'keywords',
        content:
          'ride comparison, compare ride prices, uber vs ola, rapido vs uber, cheapest cab, auto fare comparison, bike taxi fare, best ride price india',
      },
      {
        name: 'robots',
        content: 'index, follow',
      },
      {
        name: 'theme-color',
        content: '#0f172a',
      },
      {
        property: 'og:type',
        content: 'website',
      },
      {
        property: 'og:site_name',
        content: 'GetBestRide',
      },
      {
        property: 'og:title',
        content: TITLE,
      },
      {
        property: 'og:description',
        content: DESCRIPTION,
      },
      {
        property: 'og:url',
        content: CANONICAL,
      },
      {
        property: 'og:image',
        content: SOCIAL_IMAGE,
      },
      {
        property: 'og:image:width',
        content: '1038',
      },
      {
        property: 'og:image:height',
        content: '798',
      },
      {
        property: 'og:image:alt',
        content:
          'GetBestRide — compare Uber, Rapido and Ola fares side by side',
      },
      {
        name: 'twitter:card',
        content: 'summary_large_image',
      },
      {
        name: 'twitter:title',
        content: TITLE,
      },
      {
        name: 'twitter:description',
        content: DESCRIPTION,
      },
      {
        name: 'twitter:image',
        content: SOCIAL_IMAGE,
      },
      {
        name: 'twitter:image:alt',
        content:
          'GetBestRide — compare Uber, Rapido and Ola fares side by side',
      },
    ],
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: 'GetBestRide',
          url: CANONICAL,
          description: DESCRIPTION,
          applicationCategory: 'TravelApplication',
          operatingSystem: 'Web',
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'INR',
          },
        }),
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'canonical',
        href: CANONICAL,
      },
      {
        rel: 'icon',
        href: '/favicon.ico',
      },
      {
        rel: 'apple-touch-icon',
        href: '/logo.jpg',
      },
      {
        rel: 'manifest',
        href: '/manifest.json',
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script
          defer
          data-website-id="6abb82b90027431e0526"
          data-domain="getbestride.vevrcel.app"
          src="https://www.insightly.live/script.js"
        ></script>
        <script
          src="https://cdn.databuddy.cc/databuddy.js"
          data-client-id="0c7b3967-d70a-4ce2-9532-aa9a059336fa"
          data-track-web-vitals="true"
          crossOrigin="anonymous"
          async
        ></script>
      </head>
      <body suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

import { useEffect, useRef, useState } from 'react'
import { getRouteApi, Link } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import { createTanstackQueryUtils } from '@orpc/tanstack-query'
import type { QuotesRouterClient } from '@repo/api/router-types'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'
import { Spinner } from '#/components/ui/spinner'
import { LocationInput } from '#/components/location-input'
import { Logo } from '#/components/logo'

const routeApi = getRouteApi('/')
import { distanceMeters } from '#/lib/geocode/locationiq'
import { env } from '#/env'
import type { ProviderResult } from '@repo/api/router/quotes'
import { RiArrowUpDownLine, RiSparklingLine } from 'react-icons/ri'

const quotes = createTanstackQueryUtils(
  createORPCClient<QuotesRouterClient>(
    new RPCLink({ url: `${env.VITE_BACKEND_URL}/rpc` }),
  ),
)

const placeSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  label: z.string().max(500),
})

const formSchema = z.object({
  pickup: placeSchema.nullable(),
  drop: placeSchema.nullable(),
})

type FormValues = z.infer<typeof formSchema>

const PROVIDERS = [
  { key: 'rapido', label: 'Rapido' },
  { key: 'uber', label: 'Uber' },
  { key: 'ola', label: 'Ola' },
] as const

type ProviderKey = (typeof PROVIDERS)[number]['key']
type VehicleCategory = 'bike' | 'auto' | 'cab' | 'premium'

const CATEGORY_CONFIG: Record<
  VehicleCategory,
  { label: string; icon: string; description: string }
> = {
  bike: {
    label: 'Bike / 2-Wheeler',
    icon: '🛵',
    description: 'Fastest solo commute',
  },
  auto: { label: 'Auto', icon: '🛺', description: 'Doorstep auto rickshaws' },
  cab: {
    label: 'Economy / Cab',
    icon: '🚗',
    description: 'Pocket-friendly compact rides',
  },
  premium: {
    label: 'Sedan / Premium',
    icon: '🚘',
    description: 'Spacious sedans & XL rides',
  },
}

const CATEGORY_TABS = [
  { id: 'all', label: 'All Rides', icon: '⚡' },
  { id: 'bike', label: 'Bike', icon: '🛵' },
  { id: 'auto', label: 'Auto', icon: '🛺' },
  { id: 'cab', label: 'Cab', icon: '🚗' },
  { id: 'premium', label: 'Sedan / XL', icon: '🚘' },
] as const

function classifyVehicleCategory(name: string): VehicleCategory {
  const lower = name.toLowerCase()
  if (
    lower.includes('bike') ||
    lower.includes('moto') ||
    lower.includes('scoot') ||
    lower.includes('2 wheeler') ||
    lower.includes('two wheeler')
  ) {
    return 'bike'
  }
  if (lower.includes('auto') || lower.includes('tuk') || lower.includes('3w')) {
    return 'auto'
  }
  if (
    lower.includes('sedan') ||
    lower.includes('premier') ||
    lower.includes('prime') ||
    lower.includes('xl') ||
    lower.includes('suv') ||
    lower.includes('comfort') ||
    lower.includes('priority') ||
    lower.includes('pet')
  ) {
    return 'premium'
  }
  return 'cab'
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

function ProviderBadge({ provider }: { provider: ProviderKey }) {
  if (provider === 'uber') {
    return (
      <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold bg-black text-white shadow-xs">
        Uber
      </span>
    )
  }
  if (provider === 'ola') {
    return (
      <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
        Ola
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-bold bg-amber-400 text-black shadow-xs">
      Rapido
    </span>
  )
}

function FareRowSkeleton() {
  return (
    <div className="flex h-12 w-full animate-pulse items-center justify-between rounded-lg bg-gray-100 px-3">
      <div className="flex items-center gap-2.5">
        <div className="h-5 w-14 rounded bg-gray-200" />
        <div className="h-4 w-28 rounded bg-gray-200" />
      </div>
      <div className="h-5 w-16 rounded bg-gray-200" />
    </div>
  )
}

interface EnrichedOption {
  id: string
  rawId: string
  name: string
  minFare: number
  maxFare: number
  provider: ProviderKey
  providerLabel: string
  category: VehicleCategory
}

export function QuotesPage() {
  const search = routeApi.useSearch()
  const navigate = routeApi.useNavigate()
  const [viewMode, setViewMode] = useState<'category' | 'provider'>('category')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      pickup:
        search.pickupLat != null && search.pickupLng != null
          ? {
              lat: search.pickupLat,
              lng: search.pickupLng,
              label: search.pickupLabel ?? '',
            }
          : null,
      drop:
        search.dropLat != null && search.dropLng != null
          ? {
              lat: search.dropLat,
              lng: search.dropLng,
              label: search.dropLabel ?? '',
            }
          : null,
    },
    mode: 'onSubmit',
  })

  const pickup = form.watch('pickup')
  const drop = form.watch('drop')
  const ready = Boolean(pickup && drop)
  const straightLineMeters =
    pickup && drop ? distanceMeters(pickup, drop) : null

  const rapido = useMutation(quotes.quotes.rapido.mutationOptions())
  const uber = useMutation(quotes.quotes.uber.mutationOptions())
  const ola = useMutation(quotes.quotes.ola.mutationOptions())
  const mutations = { rapido, uber, ola }

  function runSearch(
    from: NonNullable<FormValues['pickup']>,
    to: NonNullable<FormValues['drop']>,
  ) {
    const input = { pickup: from, drop: to }
    rapido.reset()
    uber.reset()
    ola.reset()
    rapido.mutate(input)
    uber.mutate(input)
    ola.mutate(input)
    // Keep the URL in sync so a route is shareable and survives reloads.
    // `replace` avoids spamming history on repeated searches of one route.
    void navigate({
      search: {
        pickupLat: from.lat,
        pickupLng: from.lng,
        pickupLabel: from.label || undefined,
        dropLat: to.lat,
        dropLng: to.lng,
        dropLabel: to.label || undefined,
      },
      replace: true,
    })
  }

  function onSubmit(values: FormValues) {
    const { pickup: from, drop: to } = values
    if (!from || !to) return
    runSearch(from, to)
  }

  // Deep links and back/forward navigation: when the URL carries a complete
  // route the form doesn't have yet, adopt it and search. The key guard keeps
  // our own submit-writes from re-triggering.
  const lastSyncedKey = useRef<string | null>(null)
  useEffect(() => {
    if (
      search.pickupLat == null ||
      search.pickupLng == null ||
      search.dropLat == null ||
      search.dropLng == null
    ) {
      return
    }
    const key = `${search.pickupLat},${search.pickupLng},${search.dropLat},${search.dropLng}`
    if (key === lastSyncedKey.current) return
    lastSyncedKey.current = key
    const from = {
      lat: search.pickupLat,
      lng: search.pickupLng,
      label: search.pickupLabel ?? '',
    }
    const to = {
      lat: search.dropLat,
      lng: search.dropLng,
      label: search.dropLabel ?? '',
    }
    form.reset({ pickup: from, drop: to })
    runSearch(from, to)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.pickupLat, search.pickupLng, search.dropLat, search.dropLng])

  function handleSwap() {
    const currentPickup = form.getValues('pickup')
    const currentDrop = form.getValues('drop')
    form.setValue('pickup', currentDrop, {
      shouldValidate: Boolean(currentDrop),
    })
    form.setValue('drop', currentPickup, {
      shouldValidate: Boolean(currentPickup),
    })
    if (currentPickup && currentDrop) {
      void navigate({
        search: {
          pickupLat: currentDrop.lat,
          pickupLng: currentDrop.lng,
          pickupLabel: currentDrop.label || undefined,
          dropLat: currentPickup.lat,
          dropLng: currentPickup.lng,
          dropLabel: currentPickup.label || undefined,
        },
        replace: true,
      })
    }
  }

  const results: Record<ProviderKey, ProviderResult | undefined> = {
    rapido: rapido.data,
    uber: uber.data,
    ola: ola.data,
  }

  const anyLoading = PROVIDERS.some((p) => mutations[p.key].isPending)
  const anyResult = PROVIDERS.some((p) => results[p.key])

  // Collect and enrich all ride options
  const allOptions: EnrichedOption[] = []
  PROVIDERS.forEach(({ key, label }) => {
    const res = results[key]
    if (res?.ok && res.options) {
      for (const opt of res.options) {
        allOptions.push({
          id: `${key}-${opt.id}`,
          rawId: opt.id,
          name: opt.name,
          minFare: opt.minFare,
          maxFare: opt.maxFare,
          provider: key,
          providerLabel: label,
          category: classifyVehicleCategory(opt.name),
        })
      }
    }
  })

  // Category grouping
  const categoriesToDisplay = (
    ['bike', 'auto', 'cab', 'premium'] as const
  ).filter((cat) => selectedCategory === 'all' || selectedCategory === cat)

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Brand Header */}
      <header className="mb-8 flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-2 transition-opacity hover:opacity-90"
        >
          <Logo size="lg" />
        </Link>
        <Link
          to="/login"
          className="rounded-lg border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-700 shadow-xs hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 transition-all"
        ></Link>
      </header>

      <h1 className="text-2xl font-bold tracking-tight text-gray-900">
        Compare ride prices
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Enter a pickup and drop location to see live fares from Rapido, Uber and
        Ola side by side.
      </p>

      {/* Route Form Card */}
      <Card className="mt-6 border-gray-200/80 shadow-xs">
        <Card.Header className="pb-3">
          <Card.Title className="text-base font-semibold text-gray-900">
            Your route
          </Card.Title>
        </Card.Header>
        <Card.Content>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            {/* Visual Route Connector Container */}
            <div className="relative flex items-stretch gap-3">
              {/* Left vertical timeline indicator */}
              <div
                className="flex flex-col items-center pt-8 pb-8 shrink-0 select-none"
                aria-hidden="true"
              >
                {/* Pickup: Green ring with dot */}
                <span
                  className="flex size-3.5 items-center justify-center rounded-full border-2 border-emerald-500 bg-white shadow-xs"
                  title="Pickup"
                >
                  <span className="size-1.5 rounded-full bg-emerald-600" />
                </span>
                {/* Dotted vertical connector line */}
                <span className="my-1.5 w-0 flex-1 border-l-2 border-dashed border-gray-300" />
                {/* Drop: Red square pin */}
                <span
                  className="flex size-3.5 items-center justify-center rounded-xs border-2 border-rose-500 bg-white shadow-xs"
                  title="Drop"
                >
                  <span className="size-1.5 rounded-xs bg-rose-600" />
                </span>
              </div>

              {/* Inputs & Swap button */}
              <div className="flex flex-1 flex-col gap-2">
                <LocationInput
                  label="Pickup"
                  name="pickup-location"
                  placeholder="e.g. Thane C Cabin, Kalwa"
                  value={form.watch('pickup')}
                  origin={form.watch('drop')}
                  onChange={(v) =>
                    form.setValue('pickup', v, {
                      shouldValidate: Boolean(v),
                    })
                  }
                  error={form.formState.errors.pickup?.message}
                />

                {/* Inline swap button */}
                <div className="relative flex justify-end -my-1 z-10">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleSwap}
                    aria-label="Swap pickup and drop locations"
                    title="Swap pickup and drop"
                    className="flex h-7 items-center gap-1.5 rounded-full border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-600 shadow-xs hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 transition-all active:scale-95 cursor-pointer"
                  >
                    <RiArrowUpDownLine className="size-3.5 text-gray-500" />
                    <span>Swap</span>
                  </Button>
                </div>

                <LocationInput
                  label="Drop"
                  name="drop-location"
                  placeholder="e.g. Airoli, Navi Mumbai"
                  value={form.watch('drop')}
                  origin={form.watch('pickup')}
                  onChange={(v) =>
                    form.setValue('drop', v, {
                      shouldValidate: Boolean(v),
                    })
                  }
                  error={form.formState.errors.drop?.message}
                />
              </div>
            </div>

            {straightLineMeters !== null && (
              <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                <span className="inline-block size-1.5 rounded-full bg-indigo-500" />
                <span>
                  Estimated straight-line distance:{' '}
                  {formatDistance(straightLineMeters)}
                </span>
              </div>
            )}

            <div className="flex justify-end w-full">
              <Button
                type="submit"
                variant="primary"
                disabled={!ready || anyLoading}
                className="w-full"
              >
                {anyLoading ? 'Fetching fares…' : 'Compare fares'}
              </Button>
            </div>
            {!ready && (
              <p className="mt-2 text-right text-xs text-gray-500">
                Pick a location from the dropdown for both pickup and drop.
              </p>
            )}
          </form>
        </Card.Content>
      </Card>

      {/* Results Section */}
      {(anyResult || anyLoading) && (
        <div className="mt-8 flex flex-col gap-6">
          {/* Controls: View Mode & Category Tabs */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Category Tabs */}
            {viewMode === 'category' ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {CATEGORY_TABS.map((tab) => {
                  const isActive = selectedCategory === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSelectedCategory(tab.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-gray-900 text-white shadow-xs'
                          : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <span>{tab.icon}</span>
                      <span>{tab.label}</span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="text-sm font-semibold text-gray-800">
                Provider Breakdown
              </div>
            )}

            {/* View Mode Switcher */}
            <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50 p-0.5 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setViewMode('category')}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                  viewMode === 'category'
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                By Category
              </button>
              <button
                type="button"
                onClick={() => setViewMode('provider')}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                  viewMode === 'provider'
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                By Provider
              </button>
            </div>
          </div>

          {/* VIEW MODE 1: Categorized View */}
          {viewMode === 'category' && (
            <div className="flex flex-col gap-5">
              {categoriesToDisplay.map((catKey) => {
                const config = CATEGORY_CONFIG[catKey]
                const options = allOptions
                  .filter((o) => o.category === catKey)
                  .sort((a, b) => a.minFare - b.minFare)

                const cheapest = options[0]
                const otherProviderCheapest = cheapest
                  ? options.find((o) => o.provider !== cheapest.provider)
                  : undefined
                const savingsDelta =
                  cheapest && otherProviderCheapest
                    ? otherProviderCheapest.minFare - cheapest.minFare
                    : 0

                return (
                  <Card
                    key={catKey}
                    className="overflow-hidden border-gray-200 shadow-xs"
                  >
                    <Card.Header className="bg-gray-50/60 pb-3 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-xl"
                            role="img"
                            aria-label={config.label}
                          >
                            {config.icon}
                          </span>
                          <div>
                            <Card.Title className="text-base font-semibold text-gray-900">
                              {config.label}
                            </Card.Title>
                            <p className="text-xs text-gray-500">
                              {config.description}
                            </p>
                          </div>
                        </div>

                        {cheapest && savingsDelta > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                            <RiSparklingLine className="size-3.5 text-emerald-600" />
                            Save ₹{Math.round(savingsDelta)} vs{' '}
                            {otherProviderCheapest?.providerLabel}
                          </span>
                        )}
                      </div>
                    </Card.Header>

                    <Card.Content className="pt-3">
                      {anyLoading && options.length === 0 && (
                        <div className="flex flex-col gap-2 py-2">
                          <FareRowSkeleton />
                          <FareRowSkeleton />
                        </div>
                      )}

                      {!anyLoading && options.length === 0 && (
                        <p className="py-4 text-center text-xs text-gray-400">
                          No {config.label.toLowerCase()} rides available right
                          now.
                        </p>
                      )}

                      {options.length > 0 && (
                        <ul className="divide-y divide-gray-100">
                          {options.map((opt, index) => {
                            const isCheapest = index === 0
                            return (
                              <li
                                key={opt.id}
                                className={`flex items-center justify-between py-3 px-2 rounded-lg transition-colors ${
                                  isCheapest
                                    ? 'bg-emerald-50/40 border border-emerald-200/80 my-1'
                                    : 'hover:bg-gray-50'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <ProviderBadge provider={opt.provider} />
                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium text-gray-900">
                                        {opt.name}
                                      </span>
                                      {isCheapest && (
                                        <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-600 text-white uppercase tracking-wider">
                                          Cheapest
                                        </span>
                                      )}
                                    </div>
                                    {isCheapest && savingsDelta > 0 && (
                                      <span className="text-xs text-emerald-700 font-medium">
                                        ₹{Math.round(savingsDelta)} cheaper than{' '}
                                        {otherProviderCheapest?.providerLabel}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="text-right">
                                  <span
                                    className={`text-base font-semibold tabular-nums ${
                                      isCheapest
                                        ? 'text-emerald-700'
                                        : 'text-gray-900'
                                    }`}
                                  >
                                    {opt.minFare === opt.maxFare
                                      ? `₹${opt.minFare}`
                                      : `₹${opt.minFare} – ₹${opt.maxFare}`}
                                  </span>
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </Card.Content>
                  </Card>
                )
              })}
            </div>
          )}

          {/* VIEW MODE 2: Multi-Column Provider Grid */}
          {viewMode === 'provider' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PROVIDERS.map(({ key, label }) => {
                const mutation = mutations[key]
                const result = results[key]

                return (
                  <Card
                    key={key}
                    className="flex flex-col border-gray-200 shadow-xs"
                  >
                    <Card.Header className="pb-3 border-b border-gray-100 bg-gray-50/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ProviderBadge provider={key} />
                          <Card.Title className="text-base font-semibold text-gray-900">
                            {label}
                          </Card.Title>
                        </div>
                        {result?.ok && result.fetchedAt && (
                          <span className="text-[11px] text-gray-400">
                            {new Date(result.fetchedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>
                    </Card.Header>

                    <Card.Content className="flex-1 pt-3">
                      {/* Pulsing Skeleton Loader while fetching */}
                      {mutation.isPending && (
                        <div className="flex flex-col gap-2 py-1">
                          <div className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-1">
                            <Spinner className="size-3.5" />
                            <span>Fetching live fares…</span>
                          </div>
                          <FareRowSkeleton />
                          <FareRowSkeleton />
                          <FareRowSkeleton />
                        </div>
                      )}

                      {/* Error States */}
                      {mutation.isError && (
                        <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
                          {mutation.error.message}
                        </div>
                      )}

                      {result && !result.ok && (
                        <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                          {result.error}
                        </div>
                      )}

                      {/* Empty options */}
                      {result?.ok && result.options.length === 0 && (
                        <p className="py-6 text-center text-xs text-gray-400">
                          No {label} options available for this route.
                        </p>
                      )}

                      {/* Options List */}
                      {result?.ok && result.options.length > 0 && (
                        <ul className="divide-y divide-gray-100">
                          {[...result.options]
                            .sort((a, b) => a.minFare - b.minFare)
                            .map((o, index) => (
                              <li
                                key={o.id}
                                className="flex items-center justify-between py-2.5"
                              >
                                <div className="flex flex-col">
                                  <span className="text-sm font-medium text-gray-900">
                                    {o.name}
                                  </span>
                                  {index === 0 && (
                                    <span className="text-[10px] font-semibold text-emerald-600">
                                      Lowest on {label}
                                    </span>
                                  )}
                                </div>
                                <span className="text-sm font-semibold tabular-nums text-gray-900">
                                  {o.minFare === o.maxFare
                                    ? `₹${o.minFare}`
                                    : `₹${o.minFare} – ₹${o.maxFare}`}
                                </span>
                              </li>
                            ))}
                        </ul>
                      )}
                    </Card.Content>
                  </Card>
                )
              })}
            </div>
          )}

          {/* Footer attribution */}
          <p className="text-center text-xs text-gray-400">
            Geocoding by{' '}
            <a
              href="https://locationiq.com"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-gray-600"
            >
              LocationIQ
            </a>
          </p>
        </div>
      )}

      {!anyResult && !anyLoading && (
        <p className="mt-8 text-center text-sm text-gray-400">
          Enter pickup and drop locations to compare prices across Rapido, Uber
          and Ola.
        </p>
      )}
    </div>
  )
}

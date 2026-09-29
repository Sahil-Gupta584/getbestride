import { useEffect, useId, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { orpc } from '#/orpc/client'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Spinner } from '#/components/ui/spinner'
import { RiCrosshair2Line } from 'react-icons/ri'

/** A resolved location, as stored in the form. */
export interface SelectedPlace {
  lat: number
  lng: number
  label: string
}

interface LocationInputProps {
  label: string
  /**
   * The field's name, used by the browser's own autofill to recall addresses
   * typed here before. Keep the two fields distinct, or they will overwrite each
   * other's history.
   */
  name: string
  value: SelectedPlace | null
  onChange: (place: SelectedPlace | null) => void
  placeholder?: string
  error?: string
  /**
   * The other field's chosen point, used to measure and order suggestions.
   * Without it the dropdown falls back to LocationIQ's relevance ranking, which
   * is happy to put a same-named place in another state first.
   */
  origin?: SelectedPlace | null
}

/** Metres as a short human string: "820 m", "1.4 km", "179 km". */
function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters} m`
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`
}

/**
 * Prompts the browser for a position, as a promise. Only ever called from a
 * click handler, so this is client-side by definition. If the browser has no
 * Geolocation API the call throws, and a throw inside the Promise executor
 * rejects the promise, so that case is handled here too.
 */
function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, (err) => {
      reject(
        new Error(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied. Search for your address instead.'
            : 'Could not determine your location. Search for your address instead.',
        ),
      )
    })
  })
}

/** Matches LocationIQ's own autocomplete debounce and keeps us under their
 *  2 requests/second free-tier cap. */
const DEBOUNCE_MS = 400

/**
 * Delay a fast-changing value. LocationIQ's free tier allows 2 requests/second,
 * so firing a request per keystroke would get us rate-limited.
 */
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(t)
  }, [value, delayMs])
  return debounced
}

/**
 * Address typeahead. Shows LocationIQ suggestions as a two-line list — place name
 * on top, rest of the address beneath — and resolves the picked row to
 * coordinates. The key stays server-side; the browser only calls places.suggest.
 */
export function LocationInput({
  label,
  name,
  value,
  onChange,
  placeholder = 'Search for a location',
  error,
  origin,
}: LocationInputProps) {
  const id = useId()
  const listboxId = `${id}-listbox`

  const [text, setText] = useState(value?.label ?? '')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const blurTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    setText(value?.label ?? '')
  }, [value?.label])

  // The request fires on the debounced term, not on every keystroke.
  const query = useDebounced(text.trim(), DEBOUNCE_MS)
  const shouldSearch = open && query.length >= 3

  const placesReverse = useMutation(orpc.places.reverse.mutationOptions())

  // Keyed on the origin too: the same text means different things once the
  // sibling field is set, since ordering is measured from it.
  const originPoint = origin ? { lat: origin.lat, lng: origin.lng } : null

  const { data, isFetching } = useQuery(
    orpc.places.suggest.queryOptions({
      input: { q: query, origin: originPoint },
      enabled: shouldSearch,
      // Each term is a distinct query; hold results briefly so backspacing
      // doesn't re-request what we just fetched.
      gcTime: 5 * 60_000,
      staleTime: 10 * 60_000,
      retry: false,
    }),
  )

  const results = shouldSearch ? (data?.results ?? []) : []

  // Reordering by distance can leave the highlight past the end of the list,
  // and Enter would then resolve to the wrong row. Clamp rather than reset so
  // the keyboard selection survives a background refetch.
  useEffect(() => {
    if (!open) return
    setHighlight((h) => (results.length ? Math.min(h, results.length - 1) : 0))
  }, [results.length, open])

  // Close on outside click.
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function select(place: NonNullable<typeof data>['results'][number]) {
    onChange({ lat: place.lat, lng: place.lng, label: place.label })
    setText(place.label)
    setOpen(false)
  }

  function clear() {
    onChange(null)
    setText('')
    setOpen(false)
  }

  // "Use my current location": the browser gives coordinates, then we resolve
  // them to a label the user can recognise and edit.
  const [locating, setLocating] = useState(false)
  const [locateError, setLocateError] = useState<string | null>(null)
  const [accuracy, setAccuracy] = useState<number | null>(null)

  async function useCurrentLocation() {
    setLocating(true)
    setLocateError(null)
    try {
      const position = await getCurrentPosition()
      const { latitude, longitude, accuracy: meters } = position.coords
      setAccuracy(meters)
      const place = await placesReverse.mutateAsync({
        lat: latitude,
        lng: longitude,
      })
      onChange({ lat: place.lat, lng: place.lng, label: place.label })
      setText(place.label)
      setOpen(false)
    } catch (cause) {
      setLocateError(
        cause instanceof Error ? cause.message : 'Could not get your location.',
      )
    } finally {
      setLocating(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      if (!results.length) return
      const delta = e.key === 'ArrowDown' ? 1 : -1
      setHighlight((h) => (h + delta + results.length) % results.length)
      return
    }
    if (e.key === 'Enter') {
      // Only swallow Enter when a suggestion is actually highlighted, so the
      // form can still be submitted from an unhighlighted field.
      if (open && results[highlight]) {
        e.preventDefault()
        select(results[highlight])
      }
      return
    }
    if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div className="flex flex-col gap-1.5" ref={rootRef}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          name={name}
          value={text}
          placeholder={placeholder}
          // Intentionally NOT autoComplete="off". Leaving the browser's own
          // autofill on means a returning user gets their previously used
          // pickup/drop offered on focus, instead of retyping the same address.
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={listboxId}
          aria-autocomplete="list"
          onChange={(e) => {
            setText(e.target.value)
            setOpen(true)
            setHighlight(0)
            // Typing invalidates the previous selection; the form now waits on
            // coordinates rather than a stale point.
            if (value) onChange(null)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Delay so a click on a row registers before the list unmounts.
            blurTimer.current = setTimeout(() => setOpen(false), 150)
          }}
          onKeyDown={onKeyDown}
        />
        {(isFetching || locating) && (
          <span className="absolute top-1/2 right-3 -translate-y-1/2">
            <Spinner className="size-4" />
          </span>
        )}
        {value && !isFetching && !locating && (
          <button
            type="button"
            aria-label={`Clear ${label}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={clear}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full px-2 py-0.5 text-sm text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            ×
          </button>
        )}

        {open && shouldSearch && (
          <ul
            id={listboxId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          >
            {results.map((r, i) => (
              <li
                key={`${r.lat},${r.lng},${i}`}
                role="option"
                aria-selected={i === highlight}
              >
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    clearTimeout(blurTimer.current)
                  }}
                  onClick={() => select(r)}
                  onMouseEnter={() => setHighlight(i)}
                  className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left ${
                    i === highlight ? 'bg-gray-100' : ''
                  }`}
                >
                  <span className="flex w-full items-baseline justify-between gap-3">
                    <span className="text-sm font-medium text-gray-900">
                      {r.label}
                    </span>
                    {r.distanceMeters !== null && (
                      <span className="shrink-0 text-xs tabular-nums text-gray-400">
                        {formatDistance(r.distanceMeters)}
                      </span>
                    )}
                  </span>
                  {r.sublabel && (
                    <span className="line-clamp-2 text-xs text-gray-500">
                      {r.sublabel}
                    </span>
                  )}
                </button>
              </li>
            ))}
            {!isFetching && !results.length && (
              <li className="px-3 py-3 text-sm text-gray-500">
                No matches found.
              </li>
            )}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={locating}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-60"
        >
          <RiCrosshair2Line className="text-sm" />
          {locating ? 'Locating…' : 'Use my current location'}
        </button>
        {accuracy !== null && !locateError && (
          // A coarse fix still yields a pin, and the pin decides the price, so
          // the radius is worth showing rather than hiding.
          <span className="text-xs text-gray-400">
            accurate to about {formatDistance(Math.round(accuracy))}
            {accuracy > 200 && ' — try a nearby point for a better fare'}
          </span>
        )}
      </div>

      {locateError && <p className="text-xs text-red-600">{locateError}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

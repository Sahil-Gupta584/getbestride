import React from 'react'
import { cn } from '#/lib/utils'

interface LogoProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  variant?: 'badge' | 'flat'
}

/**
 * GetBestRide Brand Icon
 * A sleek, high-precision mobility icon representing multi-route fare comparison:
 * - Amber origin node (Rapido)
 * - Emerald comparison node (Ola)
 * - Cyan destination arrow (Uber / Best Price)
 */
export function LogoIcon({
  className,
  variant = 'badge',
}: {
  className?: string
  variant?: 'badge' | 'flat'
}) {
  if (variant === 'flat') {
    return (
      <svg
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn('size-8 shrink-0', className)}
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id="gbr-flat-route"
            x1="8"
            y1="26"
            x2="28"
            y2="10"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#10B981" />
            <stop offset="100%" stopColor="#0284C7" />
          </linearGradient>
        </defs>

        {/* Dynamic route path */}
        <path
          d="M10 26 C 10 18, 16 18, 18 18 C 22 18, 22 11, 26 10"
          stroke="url(#gbr-flat-route)"
          strokeWidth="3.2"
          strokeLinecap="round"
        />

        {/* Amber start node (Rapido) */}
        <circle cx="10" cy="26" r="3.5" fill="#F59E0B" />
        <circle cx="10" cy="26" r="1.5" fill="#FFFFFF" />

        {/* Emerald mid node (Ola) */}
        <circle cx="18" cy="18" r="2.8" fill="#10B981" />

        {/* Cyan arrow head (Uber / Best Deal) */}
        <path
          d="M21.5 7.5 L28 9.5 L26 16"
          stroke="#0284C7"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  // Default 'badge' variant: Sleek dark rounded squircle app icon
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('size-8 shrink-0 shadow-xs', className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="gbr-bg"
          x1="0"
          y1="0"
          x2="40"
          y2="40"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#0F172A" />
          <stop offset="100%" stopColor="#1E293B" />
        </linearGradient>
        <linearGradient
          id="gbr-route"
          x1="10"
          y1="28"
          x2="30"
          y2="10"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#10B981" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
        <linearGradient
          id="gbr-arrow"
          x1="22"
          y1="16"
          x2="32"
          y2="8"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#60A5FA" />
        </linearGradient>
      </defs>

      {/* Rounded squircle body */}
      <rect width="40" height="40" rx="10" fill="url(#gbr-bg)" />
      <rect
        x="0.5"
        y="0.5"
        width="39"
        height="39"
        rx="9.5"
        stroke="#334155"
        strokeOpacity="0.7"
      />

      {/* Route track comparison line */}
      <path
        d="M12 28 C 12 20, 18 20, 20 20 C 24 20, 24 13, 29 11"
        stroke="url(#gbr-route)"
        strokeWidth="2.8"
        strokeLinecap="round"
      />

      {/* Amber origin dot (Rapido) */}
      <circle cx="12" cy="28" r="3" fill="#F59E0B" />
      <circle cx="12" cy="28" r="1.2" fill="#FEF3C7" />

      {/* Emerald comparison node (Ola) */}
      <circle cx="20" cy="20" r="2.4" fill="#10B981" />

      {/* Forward destination arrow (Uber / Best Price) */}
      <path
        d="M24 8.5 L30.5 10.5 L28.5 17"
        stroke="url(#gbr-arrow)"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Logo({
  size = 'md',
  showText = true,
  variant = 'badge',
  className,
  ...props
}: LogoProps) {
  const iconSizeClass =
    size === 'sm' ? 'size-7' : size === 'lg' ? 'size-9' : 'size-8'
  const textSizeClass =
    size === 'sm' ? 'text-base' : size === 'lg' ? 'text-xl' : 'text-lg'

  return (
    <div
      className={cn('inline-flex items-center gap-2.5 select-none', className)}
      {...props}
    >
      <LogoIcon className={iconSizeClass} variant={variant} />

      {showText && (
        <span
          className={cn(
            'font-bold tracking-tight text-gray-900 inline-flex items-center leading-none',
            textSizeClass,
          )}
        >
          <span>GetBest</span>
          <span className="text-emerald-600 font-extrabold ml-0.5">Ride</span>
        </span>
      )}
    </div>
  )
}

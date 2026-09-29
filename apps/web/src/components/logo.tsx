import { cn } from '#/lib/utils'

import type React from 'react'

interface LogoProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
}

/**
 * The mark is public/favicon.ico: navy squircle, map pin, road swoosh. It's
 * already an icon-sized asset with its own rounded corners, so the header just
 * scales it — no badge behind it, no second glyph to keep in sync. The teal in
 * the swoosh is why "Ride" stays emerald.
 */
export function Logo({
  size = 'md',
  showText = true,
  className,
  ...props
}: LogoProps) {
  const mark = size === 'sm' ? 'size-7' : size === 'lg' ? 'size-10' : 'size-8'
  const text =
    size === 'sm' ? 'text-base' : size === 'lg' ? 'text-xl' : 'text-lg'

  return (
    <div
      className={cn('inline-flex items-center gap-2.5 select-none', className)}
      {...props}
    >
      <img
        src="/favicon.ico"
        alt=""
        aria-hidden="true"
        width={478}
        height={453}
        className={cn('shrink-0 object-contain', mark)}
      />

      {showText && (
        <span
          className={cn(
            'font-bold tracking-tight text-gray-900 leading-none',
            text,
          )}
        >
          <span>GetBest</span>
          <span className="text-emerald-600 font-extrabold ml-0.5">Ride</span>
        </span>
      )}
    </div>
  )
}

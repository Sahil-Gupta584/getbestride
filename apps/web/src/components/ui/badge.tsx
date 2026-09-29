import * as React from 'react'
import { cva  } from 'class-variance-authority'
import type {VariantProps} from 'class-variance-authority';
import { cn } from '#/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-indigo-50 text-indigo-700 hover:bg-indigo-100',
        secondary:
          'border-transparent bg-gray-100 text-gray-800 hover:bg-gray-200',
        destructive:
          'border-transparent bg-red-100 text-red-700 hover:bg-red-200',
        outline: 'text-gray-900 border-gray-200',
        accent: 'border-transparent bg-amber-100 text-amber-800',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  color?: string
  size?: string
}

function Badge({ className, variant, color, size, ...props }: BadgeProps) {
  let resolvedVariant = variant
  if (color === 'accent') resolvedVariant = 'accent'
  if (color === 'default') resolvedVariant = 'secondary'

  return (
    <div
      className={cn(badgeVariants({ variant: resolvedVariant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }

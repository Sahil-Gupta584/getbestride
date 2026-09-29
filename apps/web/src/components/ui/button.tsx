import * as React from 'react'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'
import { cn } from '#/lib/utils'
import { RiLoader4Line } from 'react-icons/ri'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm',
        secondary:
          'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 shadow-sm',
        danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
        ghost: 'hover:bg-gray-100 text-gray-700',
        link: 'text-indigo-600 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-11 rounded-md px-8 text-base',
        icon: 'h-8 w-8 p-0',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** HeroUI compat */
  color?: string
  isLoading?: boolean
  startContent?: React.ReactNode
  endContent?: React.ReactNode
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'secondary',
      size,
      color,
      isLoading,
      startContent,
      endContent,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    let finalVariant = variant
    if (color === 'primary') {
      finalVariant = variant === 'ghost' ? 'ghost' : 'primary'
    } else if (color === 'danger') {
      finalVariant = 'danger'
    }

    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant: finalVariant, size, className }))}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <RiLoader4Line className="animate-spin text-base" />
        ) : (
          startContent
        )}
        {children}
        {!isLoading && endContent}
      </button>
    )
  },
)
Button.displayName = 'Button'

export { buttonVariants }
export type CustomButtonProps = ButtonProps

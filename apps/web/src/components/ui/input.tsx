import * as React from 'react'
import { cn } from '#/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode
  description?: React.ReactNode
  errorMessage?: React.ReactNode
  isInvalid?: boolean
  isRequired?: boolean
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, label, description, errorMessage, isInvalid, isRequired, id, ...props },
    ref,
  ) => {
    const generatedId = React.useId()
    const inputId = id || generatedId

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
            {label}
            {isRequired && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={cn(
            'flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            isInvalid && 'border-red-500 focus-visible:ring-red-500',
            className,
          )}
          {...props}
        />
        {description && <p className="text-xs text-gray-500">{description}</p>}
        {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
      </div>
    )
  },
)
Input.displayName = 'Input'

export type CustomInputProps = InputProps

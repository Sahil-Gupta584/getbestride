import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { RiArrowDownSLine, RiCheckLine } from 'react-icons/ri'
import { cn } from '#/lib/utils'

export interface SelectProps {
  label?: string
  placeholder?: string
  selectedKeys?: unknown
  value?: unknown
  onChange?: (value: string) => void
  children?: React.ReactNode
  required?: boolean
  isRequired?: boolean
  [key: string]: unknown
}

export function Select({
  label,
  placeholder = 'Select an option',
  selectedKeys,
  value,
  onChange,
  children,
  required,
  isRequired,
}: SelectProps) {
  const actualValue =
    value !== undefined
      ? String(value)
      : selectedKeys
        ? String(Array.from(selectedKeys as Iterable<unknown>)[0])
        : undefined

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {(isRequired || required) && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <SelectPrimitive.Root value={actualValue} onValueChange={onChange}>
        <SelectPrimitive.Trigger
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon>
            <RiArrowDownSLine className="h-4 w-4 opacity-50" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content className="relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-white text-gray-950 shadow-md animate-in fade-in-80">
            <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  )
}

export function SelectItem({ children, value, key }: { children?: React.ReactNode; value?: string; key?: string }) {
  const itemId = String(value || key)
  return (
    <SelectPrimitive.Item
      value={itemId}
      className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-gray-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <RiCheckLine className="h-4 w-4 text-indigo-600" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

export type CustomSelectProps = SelectProps

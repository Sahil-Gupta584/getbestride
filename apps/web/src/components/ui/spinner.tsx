import { RiLoader4Line } from 'react-icons/ri'
import { cn } from '#/lib/utils'

export function Spinner({ className }: { className?: string }) {
  return (
    <RiLoader4Line
      className={cn('animate-spin text-xl text-indigo-600', className)}
    />
  )
}

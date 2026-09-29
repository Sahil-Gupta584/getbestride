// Unified shadcn/ui barrel — import everything from '#/components/ui'
// Canonical source-of-truth for the SaaS template. Keeps imports unified, no scattering.

export { Button, buttonVariants } from './button'
export type { ButtonProps, CustomButtonProps } from './button'

export { Input } from './input'
export type { InputProps, CustomInputProps } from './input'

export { Select, SelectItem } from './select'
export type { SelectProps, CustomSelectProps } from './select'

export { Label } from './label'

export { Avatar } from './avatar'
export { Badge, badgeVariants } from './badge'
export { Card } from './card'
export { Modal, Dialog, DialogTrigger, DialogPortal, DialogOverlay, DialogContent, DialogHeader, DialogFooter } from './dialog'
export { Dropdown } from './dropdown-menu'
export { Separator } from './separator'
export { Spinner } from './spinner'
export { Tooltip } from './tooltip'

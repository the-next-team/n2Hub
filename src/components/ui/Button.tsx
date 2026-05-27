import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const base =
  'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface'

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover',
  secondary: 'border border-line text-content-muted hover:bg-surface-hover hover:text-content',
  ghost: 'text-content-muted hover:bg-surface-hover hover:text-content',
  danger:
    'text-content-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400',
}

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
}

function buttonClass(variant: Variant, size: Size, className?: string) {
  return cn(base, variants[variant], sizes[size], className)
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
}

export default function Button({ variant = 'primary', size = 'md', className, ...props }: Props) {
  return <button className={buttonClass(variant, size, className)} {...props} />
}

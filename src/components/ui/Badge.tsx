import type { ReactNode } from 'react'
import { cn } from '../../utils'

type Tone = 'gray' | 'green' | 'blue' | 'orange' | 'purple' | 'red'

const tones: Record<Tone, string> = {
  gray: 'bg-surface-hover text-content-muted',
  green: 'bg-success-soft text-success',
  blue: 'bg-primary-soft text-primary',
  orange: 'bg-warning-soft text-warning',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400',
  red: 'bg-danger-soft text-danger',
}

type Props = {
  tone?: Tone
  className?: string
  children: ReactNode
}

export default function Badge({ tone = 'gray', className, children }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

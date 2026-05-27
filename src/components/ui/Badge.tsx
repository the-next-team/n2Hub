import type { ReactNode } from 'react'
import { cn } from '../../utils'

type Tone = 'gray' | 'green' | 'blue' | 'orange' | 'purple' | 'red'

const tones: Record<Tone, string> = {
  gray: 'bg-surface-hover text-content-muted',
  green: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400',
  blue: 'bg-primary-soft text-primary',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400',
  red: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
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

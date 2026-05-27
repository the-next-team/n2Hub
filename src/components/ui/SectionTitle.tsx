import type { ReactNode } from 'react'
import { cn } from '../../utils'

type Props = {
  children: ReactNode
  className?: string
}

export default function SectionTitle({ children, className }: Props) {
  return <h2 className={cn('text-base font-semibold text-content', className)}>{children}</h2>
}

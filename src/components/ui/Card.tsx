import type { HTMLAttributes } from 'react'
import { cn } from '../../utils'

type Props = HTMLAttributes<HTMLDivElement>

export default function Card({ className, ...props }: Props) {
  return <div className={cn('rounded-xl border border-line bg-surface', className)} {...props} />
}

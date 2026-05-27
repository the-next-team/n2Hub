import type { ReactNode } from 'react'
import { cn } from '../../utils'

type Props = {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}

export default function PageHeader({ title, description, actions, className }: Props) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-content">{title}</h1>
        {description && <p className="mt-1 text-content-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

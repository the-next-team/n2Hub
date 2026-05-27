import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  Settings,
  PanelLeftClose,
  PanelLeft,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../utils'

type NavItem = { to: string; icon: LucideIcon; label: string }
type NavSection = { title: string; items: NavItem[] }

const sections: NavSection[] = [
  {
    title: '워크스페이스',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: '대시보드' },
      { to: '/projects', icon: FolderKanban, label: '프로젝트' },
    ],
  },
  {
    title: '관리',
    items: [
      { to: '/templates', icon: FileText, label: '템플릿' },
      { to: '/settings', icon: Settings, label: '설정' },
    ],
  },
]

type Props = {
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}

export default function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: Props) {
  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-line bg-surface',
        'transition-[width,transform] duration-200 ease-out',
        collapsed ? 'w-16' : 'w-60',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
        'lg:static lg:translate-x-0',
      )}
    >
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-line px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
          n2
        </div>
        {!collapsed && <span className="text-lg font-bold text-content">n2Hub</span>}
        <button
          onClick={onCloseMobile}
          className="ml-auto rounded-md p-1 text-content-muted hover:bg-surface-hover hover:text-content lg:hidden"
          aria-label="사이드바 닫기"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto p-3">
        {sections.map(section => (
          <div key={section.title}>
            {!collapsed && (
              <p className="mb-1.5 px-3 text-xs font-medium uppercase tracking-wider text-content-subtle">
                {section.title}
              </p>
            )}
            <div className="space-y-1">
              {section.items.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={onCloseMobile}
                  aria-label={label}
                  title={collapsed ? label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      collapsed && 'justify-center px-0',
                      isActive
                        ? 'bg-primary-soft font-medium text-primary'
                        : 'text-content-muted hover:bg-surface-hover hover:text-content',
                    )
                  }
                >
                  <Icon size={18} className="shrink-0" />
                  {!collapsed && <span>{label}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="hidden border-t border-line p-3 lg:block">
        <button
          onClick={onToggleCollapse}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-content-muted transition-colors hover:bg-surface-hover hover:text-content',
            collapsed && 'justify-center px-0',
          )}
          aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
          title={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
        >
          {collapsed ? (
            <PanelLeft size={18} />
          ) : (
            <>
              <PanelLeftClose size={18} />
              <span>접기</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}

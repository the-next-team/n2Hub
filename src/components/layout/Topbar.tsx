import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, Sun, Moon, ChevronRight, LogOut, Home } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { cn } from '../../utils'

const labelMap: Record<string, string> = {
  dashboard: '대시보드',
  projects: '프로젝트',
  templates: '템플릿',
  settings: '설정',
  documents: '산출물',
  tasks: '작업',
  view: '미리보기',
  new: '새로 만들기',
}

function isIdSegment(seg: string): boolean {
  return /^[0-9a-f-]{8,}$/i.test(seg) || /^\d+$/.test(seg)
}

function useCrumbs() {
  const { pathname } = useLocation()
  const segs = pathname.split('/').filter(Boolean)
  return segs.map((seg, i) => ({
    path: '/' + segs.slice(0, i + 1).join('/'),
    label: labelMap[seg] ?? (isIdSegment(seg) ? '상세' : seg),
  }))
}

type Props = {
  dark: boolean
  onToggleTheme: () => void
  onOpenMobile: () => void
}

export default function Topbar({ dark, onToggleTheme, onOpenMobile }: Props) {
  const crumbs = useCrumbs()

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
      <button
        onClick={onOpenMobile}
        className="rounded-md p-1.5 text-content-muted hover:bg-surface-hover hover:text-content lg:hidden"
        aria-label="메뉴 열기"
      >
        <Menu size={20} />
      </button>

      <nav className="flex min-w-0 items-center gap-1.5 text-sm">
        <Link to="/dashboard" className="text-content-subtle hover:text-content" aria-label="홈">
          <Home size={15} />
        </Link>
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1
          return (
            <span key={crumb.path} className="flex min-w-0 items-center gap-1.5">
              <ChevronRight size={14} className="shrink-0 text-content-subtle" />
              {last ? (
                <span className="truncate font-medium text-content">{crumb.label}</span>
              ) : (
                <Link to={crumb.path} className="truncate text-content-muted hover:text-content">
                  {crumb.label}
                </Link>
              )}
            </span>
          )
        })}
      </nav>

      <div className="ml-auto flex items-center gap-1">
        <button
          onClick={onToggleTheme}
          className="rounded-lg p-2 text-content-muted transition-colors hover:bg-surface-hover hover:text-content"
          aria-label={dark ? '라이트 모드로 전환' : '다크 모드로 전환'}
          title={dark ? '라이트 모드' : '다크 모드'}
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <UserMenu />
      </div>
    </header>
  )
}

function UserMenu() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const initial = user?.email?.[0]?.toUpperCase() ?? '?'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="사용자 메뉴"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg p-1 pr-2 transition-colors hover:bg-surface-hover"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
          {initial}
        </span>
        <span className="hidden max-w-[140px] truncate text-sm text-content-muted sm:block">
          {user?.email}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-xl border border-line bg-surface shadow-popover">
          <div className="border-b border-line px-4 py-3">
            <p className="text-xs text-content-subtle">로그인 계정</p>
            <p className="truncate text-sm font-medium text-content">{user?.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className={cn(
              'flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-content-muted transition-colors',
              'hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400',
            )}
          >
            <LogOut size={16} />
            로그아웃
          </button>
        </div>
      )}
    </div>
  )
}

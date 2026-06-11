import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Menu, Sun, Moon, ChevronRight, LogOut, Home, Bell, Check, ClipboardList, Plus, Send, Loader2 } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'
import { UserAvatar } from '../UserAvatar'
import { useProject } from '../../hooks/useProject'
import { useNotifications } from '../../hooks/useNotifications'
import { useActionItems } from '../../hooks/useActionItems'
import { useMembers } from '../../hooks/useMembers'
import { cn } from '../../utils'

const labelMap: Record<string, string> = {
  dashboard:    '대시보드',
  projects:     '프로젝트',
  templates:    '템플릿',
  settings:     '설정',
  documents:    '산출물',
  tasks:        'WBS 작업관리',
  gantt:        '간트 차트',
  issues:       '이슈 관리',
  calendar:     '캘린더',
  activity:     '활동 로그',
  members:      '멤버 관리',
  sprints:      '스프린트',
  'ai-search':  'AI 문서 검색',
  'action-items': '액션 아이템',
  view:         '미리보기',
  new:          '새로 만들기',
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
  const crumbs   = useCrumbs()
  const { id }   = useParams<{ id?: string }>()
  const { project } = useProject(id ?? '')
  const [imgErr, setImgErr] = useState(false)

  const accent   = project?.themeColor ?? '#4f46e5'
  const initials = project ? (project.systemCode || project.name).slice(0, 2).toUpperCase() : ''

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
        <Link to="/dashboard" className="text-content-subtle hover:text-content shrink-0" aria-label="홈">
          <Home size={15} />
        </Link>

        {/* 프로젝트 내부일 때 로고 배지 표시 */}
        {id && project && (
          <span className="flex items-center gap-1.5 shrink-0">
            <ChevronRight size={14} className="text-content-subtle" />
            <Link
              to={`/projects/${id}`}
              className="flex items-center gap-1.5 px-1.5 py-0.5 rounded-lg hover:bg-surface-hover transition-colors"
            >
              {project.logoUrl && !imgErr ? (
                <img
                  src={project.logoUrl}
                  alt={project.name}
                  className="w-5 h-5 rounded object-contain"
                  onError={() => setImgErr(true)}
                />
              ) : (
                <span
                  className="w-5 h-5 rounded flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                  style={{ backgroundColor: accent }}
                >
                  {initials}
                </span>
              )}
              {project.systemCode && (
                <span className="text-xs font-mono font-semibold text-content hidden sm:block">
                  {project.systemCode}
                </span>
              )}
              <span className="text-xs text-content-muted truncate max-w-[120px] hidden md:block">
                {project.name}
              </span>
            </Link>
          </span>
        )}

        {/* 나머지 브레드크럼 (프로젝트 ID 세그먼트 제외) */}
        {crumbs
          .filter(c => !c.path.endsWith(`/projects/${id}`) && !(id && c.path === `/projects/${id}`))
          .filter(c => c.label !== '상세')
          .map((crumb, i, arr) => {
            const last = i === arr.length - 1
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
        <ActionItemQuickButton />
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  )
}

function ActionItemQuickButton() {
  const { id: projectId } = useParams<{ id?: string }>()
  const { create }  = useActionItems(projectId)
  const { members } = useMembers(projectId ?? 'none')
  const [open, setOpen]         = useState(false)
  const [title, setTitle]       = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [dueDate, setDueDate]   = useState('')
  const [saving, setSaving]     = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  if (!projectId) return null

  const handleSave = async () => {
    if (!title.trim() || saving) return
    setSaving(true)
    try {
      const member = members.find(m => m.user_id === assigneeId)
      await create(projectId, {
        title: title.trim(),
        assigneeId:   member?.user_id,
        assigneeName: member?.display_name || member?.email?.split('@')[0],
        dueDate:      dueDate || undefined,
        source: 'manual',
      })
      setTitle(''); setAssigneeId(''); setDueDate(''); setOpen(false)
    } finally { setSaving(false) }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        title="액션 아이템 빠른 등록"
        className={cn(
          'rounded-lg p-2 transition-colors flex items-center gap-1.5',
          open
            ? 'bg-amber-100 text-amber-700'
            : 'text-content-muted hover:bg-surface-hover hover:text-content'
        )}
      >
        <ClipboardList size={17} />
        <Plus size={11} className="opacity-70" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 bg-surface border border-line rounded-2xl shadow-popover overflow-hidden animate-fade-in-scale">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-line bg-amber-50">
            <ClipboardList size={14} className="text-amber-600" />
            <span className="text-sm font-semibold text-amber-900">액션 아이템 등록</span>
          </div>
          <div className="p-3 space-y-2.5">
            <input
              autoFocus value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSave()}
              placeholder="할 일을 입력하세요..."
              className="w-full px-3 py-2 border border-line rounded-lg text-sm bg-canvas focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 transition"
            />
            <div className="grid grid-cols-2 gap-2">
              <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)}
                className="px-2 py-1.5 border border-line rounded-lg text-xs bg-canvas focus:outline-none focus:ring-1 focus:ring-amber-400/40 transition text-content-muted">
                <option value="">담당자</option>
                {members.map(m => (
                  <option key={m.user_id} value={m.user_id}>{m.display_name || m.email}</option>
                ))}
              </select>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="px-2 py-1.5 border border-line rounded-lg text-xs bg-canvas focus:outline-none focus:ring-1 focus:ring-amber-400/40 transition text-content-muted" />
            </div>
            <button onClick={handleSave} disabled={!title.trim() || saving}
              className="w-full flex items-center justify-center gap-2 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-40">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              등록
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative rounded-lg p-2 text-content-muted transition-colors hover:bg-surface-hover hover:text-content"
        aria-label="알림"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-80 rounded-xl border border-line bg-surface shadow-popover overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <p className="text-sm font-semibold text-content">알림</p>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-primary hover:underline">
                <Check size={12} /> 전체 읽음
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center text-sm text-content-subtle">알림이 없습니다</div>
            ) : notifications.map(n => (
              <div
                key={n.id}
                onClick={() => { markRead(n.id); if (n.link) { navigate(n.link); setOpen(false) } }}
                className={cn(
                  'flex gap-3 px-4 py-3 border-b border-line cursor-pointer hover:bg-surface-hover transition-colors',
                  !n.read && 'bg-primary-soft/30'
                )}
              >
                {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />}
                <div className={cn('flex-1 min-w-0', n.read && 'pl-4')}>
                  <p className="text-xs font-medium text-content leading-snug">{n.title}</p>
                  {n.body && <p className="text-xs text-content-subtle mt-0.5 line-clamp-2">{n.body}</p>}
                  <p className="text-[10px] text-content-subtle mt-1">
                    {new Date(n.createdAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function UserMenu() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // 프로필 이름 조회 (profiles → user_metadata → 이메일 앞부분 순 fallback)
  useEffect(() => {
    if (!user?.id) return
    supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        const name = data?.display_name
          || (user.user_metadata?.display_name as string | undefined)
          || user.email?.split('@')[0]
          || ''
        setDisplayName(name)
      })
  }, [user?.id, user?.email, user?.user_metadata?.display_name])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const meta        = user?.user_metadata ?? {}
  const initial     = (displayName || user?.email || '?')[0].toUpperCase()
  const avatarUrl   = meta.avatar_url   as string | undefined
  const avatarEmoji = meta.avatar_emoji as string | undefined
  const avatarBg    = meta.avatar_bg    as string | undefined

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="사용자 메뉴"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg p-1 pr-2 transition-colors hover:bg-surface-hover"
      >
        <UserAvatar
          avatarUrl={avatarUrl} avatarEmoji={avatarEmoji} avatarBg={avatarBg}
          initial={initial} size={28}
          className="ring-2 ring-surface-hover"
        />
        <span className="hidden flex-col items-start leading-tight sm:flex">
          <span className="max-w-[140px] truncate text-sm font-medium text-content">
            {displayName}
          </span>
          <span className="max-w-[140px] truncate text-[11px] text-content-subtle">
            {user?.email}
          </span>
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-xl border border-line bg-surface shadow-popover">
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-semibold text-content">{displayName}</p>
            <p className="truncate text-xs text-content-subtle mt-0.5">{user?.email}</p>
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

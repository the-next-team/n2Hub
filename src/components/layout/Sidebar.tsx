import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, FolderKanban, FileText, Settings,
  PanelLeftClose, PanelLeft, X,
  ChevronRight, ChevronDown, Folder, FolderOpen,
  ClipboardList, Users, Plus, Loader2,
} from 'lucide-react'
import { cn } from '../../utils'
import { useProjects } from '../../hooks/useProject'

type Props = {
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}

const SUB_ITEMS = [
  { label: '산출물 목록',   icon: FileText,       suffix: '/documents' },
  { label: 'WBS 작업관리', icon: ClipboardList,  suffix: '/tasks' },
  { label: '멤버 관리',    icon: Users,          suffix: '/members' },
]

export default function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: Props) {
  const location = useLocation()
  const { projects, loading } = useProjects()

  // 현재 URL에서 프로젝트 ID 추출
  const activeProjectId = location.pathname.match(/\/projects\/([^/]+)/)?.[1] ?? null

  // 열려 있는 프로젝트 set
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())

  // 활성 프로젝트는 자동 펼침
  useEffect(() => {
    if (activeProjectId) {
      setOpenIds(prev => new Set([...prev, activeProjectId]))
    }
  }, [activeProjectId])

  function toggleProject(id: string) {
    setOpenIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

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
      {/* 로고 */}
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

      <nav className="flex-1 overflow-y-auto p-3 space-y-5">

        {/* ── 워크스페이스 ── */}
        <div>
          {!collapsed && (
            <p className="mb-1.5 px-3 text-xs font-medium uppercase tracking-wider text-content-subtle">
              워크스페이스
            </p>
          )}
          <div className="space-y-1">
            {/* 대시보드 */}
            <NavLink
              to="/dashboard"
              onClick={onCloseMobile}
              aria-label="대시보드"
              title={collapsed ? '대시보드' : undefined}
              className={({ isActive }) => cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                collapsed && 'justify-center px-0',
                isActive
                  ? 'bg-primary-soft font-medium text-primary'
                  : 'text-content-muted hover:bg-surface-hover hover:text-content',
              )}
            >
              <LayoutDashboard size={18} className="shrink-0" />
              {!collapsed && <span>대시보드</span>}
            </NavLink>

            {/* 프로젝트 트리 */}
            {!collapsed && (
              <div>
                {/* 프로젝트 헤더 */}
                <div className="flex items-center gap-1 px-3 py-1.5 group">
                  <NavLink
                    to="/projects"
                    onClick={onCloseMobile}
                    className={({ isActive }) => cn(
                      'flex flex-1 items-center gap-2 text-sm transition-colors',
                      isActive && location.pathname === '/projects'
                        ? 'font-medium text-primary'
                        : 'text-content-muted hover:text-content',
                    )}
                  >
                    <FolderKanban size={16} className="shrink-0" />
                    <span>프로젝트</span>
                  </NavLink>
                  <NavLink
                    to="/projects/new"
                    onClick={onCloseMobile}
                    title="새 프로젝트"
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-content-subtle hover:text-primary transition-all"
                  >
                    <Plus size={13} />
                  </NavLink>
                </div>

                {/* 프로젝트 목록 */}
                <div className="ml-2 space-y-0.5">
                  {loading ? (
                    <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-content-subtle">
                      <Loader2 size={12} className="animate-spin" /> 로딩 중...
                    </div>
                  ) : projects.length === 0 ? (
                    <p className="px-3 py-1.5 text-xs text-content-subtle italic">프로젝트 없음</p>
                  ) : (
                    projects.map(project => {
                      const isOpen   = openIds.has(project.id)
                      const isActive = activeProjectId === project.id

                      return (
                        <div key={project.id}>
                          {/* 프로젝트 행 */}
                          <button
                            onClick={() => { toggleProject(project.id); onCloseMobile() }}
                            className={cn(
                              'flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors',
                              isActive
                                ? 'bg-primary-soft text-primary font-medium'
                                : 'text-content-muted hover:bg-surface-hover hover:text-content',
                            )}
                          >
                            {isOpen
                              ? <ChevronDown size={13} className="shrink-0 opacity-60" />
                              : <ChevronRight size={13} className="shrink-0 opacity-60" />
                            }
                            {isOpen
                              ? <FolderOpen size={14} className="shrink-0" />
                              : <Folder size={14} className="shrink-0" />
                            }
                            <span className="truncate text-xs">{project.name}</span>
                          </button>

                          {/* 서브메뉴 */}
                          {isOpen && (
                            <div className="ml-5 mt-0.5 mb-1 space-y-0.5 border-l border-line pl-2">
                              {SUB_ITEMS.map(({ label, icon: Icon, suffix }) => (
                                <NavLink
                                  key={suffix}
                                  to={`/projects/${project.id}${suffix}`}
                                  onClick={onCloseMobile}
                                  className={({ isActive: a }) => cn(
                                    'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
                                    a
                                      ? 'bg-primary-soft font-medium text-primary'
                                      : 'text-content-muted hover:bg-surface-hover hover:text-content',
                                  )}
                                >
                                  <Icon size={12} className="shrink-0" />
                                  <span>{label}</span>
                                </NavLink>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}

            {/* collapsed 상태에서 프로젝트 아이콘만 */}
            {collapsed && (
              <NavLink
                to="/projects"
                aria-label="프로젝트"
                title="프로젝트"
                onClick={onCloseMobile}
                className={({ isActive }) => cn(
                  'flex items-center justify-center rounded-lg px-0 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-primary-soft font-medium text-primary'
                    : 'text-content-muted hover:bg-surface-hover hover:text-content',
                )}
              >
                <FolderKanban size={18} className="shrink-0" />
              </NavLink>
            )}
          </div>
        </div>

        {/* ── 관리 ── */}
        <div>
          {!collapsed && (
            <p className="mb-1.5 px-3 text-xs font-medium uppercase tracking-wider text-content-subtle">
              관리
            </p>
          )}
          <div className="space-y-1">
            {[
              { to: '/templates', icon: FileText, label: '템플릿' },
              { to: '/settings',  icon: Settings, label: '설정'   },
            ].map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                onClick={onCloseMobile}
                aria-label={label}
                title={collapsed ? label : undefined}
                className={({ isActive }) => cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  collapsed && 'justify-center px-0',
                  isActive
                    ? 'bg-primary-soft font-medium text-primary'
                    : 'text-content-muted hover:bg-surface-hover hover:text-content',
                )}
              >
                <Icon size={18} className="shrink-0" />
                {!collapsed && <span>{label}</span>}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      {/* 접기 버튼 */}
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
          {collapsed ? <PanelLeft size={18} /> : <><PanelLeftClose size={18} /><span>접기</span></>}
        </button>
      </div>
    </aside>
  )
}

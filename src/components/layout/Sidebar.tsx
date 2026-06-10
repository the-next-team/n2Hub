import { useState, useEffect, useCallback, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

/** 프로젝트 WBS 진척률 (실제 평균) */
function useWbsProgress(projectId: string, enabled: boolean) {
  const [pct, setPct] = useState<number | null>(null)
  useEffect(() => {
    if (!enabled || !projectId) return
    supabase.from('wbs_tasks').select('actual_progress').eq('project_id', projectId).eq('wbs_level', 3)
      .then(({ data }) => {
        if (!data?.length) { setPct(0); return }
        const avg = data.reduce((s, t) => s + (t.actual_progress ?? 0), 0) / data.length
        setPct(Math.round(avg * 100))
      })
  }, [projectId, enabled])
  return pct
}
import {
  LayoutDashboard, FolderKanban, FileText, Settings,
  PanelLeftClose, PanelLeft, X,
  ChevronRight, ChevronDown, Folder, FolderOpen,
  ClipboardList, Users, Plus, Loader2, BarChart2, AlertCircle, CalendarDays, Activity, SearchCode,
  GripVertical, Star, StickyNote, FileSpreadsheet, Presentation, Mic,
} from 'lucide-react'

/* ── 파일 타입별 아이콘 (사이드바용) ── */
function SidebarFileIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['xlsx','xls','csv','ods'].includes(ext))  return <FileSpreadsheet size={11} className="shrink-0 text-green-500" />
  if (['pptx','ppt','odp'].includes(ext))        return <Presentation    size={11} className="shrink-0 text-orange-500" />
  if (['pdf'].includes(ext))                     return <FileText        size={11} className="shrink-0 text-red-500" />
  if (['docx','doc','odt','rtf'].includes(ext))  return <FileText        size={11} className="shrink-0 text-blue-500" />
  if (['hwp','hwpx'].includes(ext))              return <FileText        size={11} className="shrink-0 text-teal-500" />
  if (['md','txt'].includes(ext))                return <FileText        size={11} className="shrink-0 text-purple-400" />
  return <FileText size={11} className="shrink-0 opacity-50" />
}

/* ── 프로젝트 서브메뉴 정의 ── */
interface NavItemDef { key: string; icon: React.ElementType; label: string }

const ALL_NAV_ITEMS: NavItemDef[] = [
  { key: 'documents', icon: FileText,    label: '산출물'       },
  { key: 'tasks',     icon: ClipboardList,label: 'WBS 작업관리' },
  { key: 'action-items', icon: StickyNote, label: '액션 아이템'  },
  { key: 'meeting',      icon: Mic,        label: '회의'          },
  // { key: 'sprints', icon: CalendarDays, label: '스프린트' }, // 임시 비활성화
  { key: 'gantt',     icon: BarChart2,   label: '간트 차트'    },
  { key: 'ai-search', icon: SearchCode,  label: 'AI 문서 검색' },
  { key: 'issues',    icon: AlertCircle, label: '이슈 관리'    },
  { key: 'calendar',  icon: CalendarDays,label: '캘린더'       },
  { key: 'activity',  icon: Activity,    label: '활동 로그'    },
  { key: 'members',   icon: Users,       label: '멤버 관리'    },
]
const DEFAULT_ORDER = ALL_NAV_ITEMS.map(i => i.key)
const NAV_ORDER_KEY = 'n2hub-nav-order'

const FAV_KEY = 'n2hub-nav-favorites'
function loadFavorites(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(FAV_KEY) ?? '[]')) }
  catch { return new Set() }
}

function loadNavOrder(): string[] {
  try {
    const s = localStorage.getItem(NAV_ORDER_KEY)
    if (!s) return DEFAULT_ORDER
    const saved: string[] = JSON.parse(s)
    // 새로 추가된 항목은 끝에 붙이기
    const extra = DEFAULT_ORDER.filter(k => !saved.includes(k))
    return [...saved.filter(k => DEFAULT_ORDER.includes(k)), ...extra]
  } catch { return DEFAULT_ORDER }
}
import { cn } from '../../utils'
import { useProjects } from '../../hooks/useProject'
import type { Project } from '../../types'
import { supabase } from '../../lib/supabase'

/* ── 사이드바용 파일명 표시 (코드 + 버전 제거, 제목만) ── */
function sidebarLabel(fileName: string): string {
  // 원본 파일명 그대로 표시
  return fileName
}

/* ── 프로젝트 로고 ── */
function ProjectLogo({ project, size = 16 }: { project: Project; size?: number }) {
  const [err, setErr] = useState(false)
  const accent   = project.themeColor ?? '#4f46e5'
  const initials = (project.systemCode || project.name).slice(0, 2).toUpperCase()

  if (project.logoUrl && !err) {
    return (
      <img
        src={project.logoUrl}
        alt={project.name}
        onError={() => setErr(true)}
        style={{ width: size, height: size }}
        className="rounded object-contain shrink-0 bg-surface-hover"
      />
    )
  }
  return (
    <span
      style={{ width: size, height: size, backgroundColor: accent, fontSize: size * 0.45 }}
      className="rounded flex items-center justify-center text-white font-bold shrink-0"
    >
      {initials}
    </span>
  )
}

type Props = {
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}

/* ── 사이드바 파일트리 ── */
// 각 폴더 노드가 독립적으로 상태를 관리하는 재귀 컴포넌트 방식
// → stale closure 없이 확실하게 열림/닫힘 동작

type SFNode = { id: string; name: string; isFolder: boolean }

async function loadFolder(projectId: string, folderPath: string): Promise<SFNode[]> {
  const { data } = await supabase
    .from('files')
    .select('id, original_name, mime_type')
    .eq('project_id', projectId)
    .eq('folder_path', folderPath)
    .order('mime_type', { ascending: false })
    .order('original_name', { ascending: true })
  return (data || []).map(r => ({
    id: r.id,
    name: r.original_name,
    isFolder: r.mime_type === 'folder',
  }))
}

// 개별 폴더 노드 — 자체 open/children 상태 관리
function FolderNode({
  projectId, node, folderPath, onClose,
}: {
  projectId: string
  node: SFNode
  folderPath: string   // 이 폴더 자신의 전체 경로 (부모path/이름)
  onClose: () => void
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [children, setChildren] = useState<SFNode[]>([])

  async function toggle() {
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    if (children.length === 0) {
      setLoading(true)
      const items = await loadFolder(projectId, folderPath)
      setChildren(items)
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={toggle}
        className={cn(
          'flex w-full items-center gap-1.5 py-1 pr-1 rounded-md text-xs transition-colors',
          open
            ? 'text-content bg-surface-hover'
            : 'text-content-muted hover:bg-surface-hover hover:text-content'
        )}
      >
        <span className="shrink-0 w-3 flex items-center justify-center">
          {loading
            ? <Loader2 size={10} className="animate-spin text-primary" />
            : open
              ? <ChevronDown size={10} className="text-primary" />
              : <ChevronRight size={10} className="opacity-50" />}
        </span>
        {open
          ? <FolderOpen size={13} className="shrink-0 text-yellow-500" />
          : <Folder     size={13} className="shrink-0 text-yellow-400" />}
        <span
          className={cn('truncate', open ? 'font-semibold text-content' : 'font-medium')}
          title={node.name}
        >
          {sidebarLabel(node.name)}
        </span>
      </button>

      {open && (
        <div className="border-l-2 border-primary/30 ml-2 pl-2 my-1 space-y-0.5 bg-primary-soft/20 rounded-r-md">
          {loading && children.length === 0 && (
            <div className="flex items-center gap-1 py-0.5 text-xs text-content-subtle">
              <Loader2 size={9} className="animate-spin" /> 불러오는 중…
            </div>
          )}
          {children.map(child =>
            child.isFolder ? (
              <FolderNode
                key={child.id}
                projectId={projectId}
                node={child}
                folderPath={`${folderPath}/${child.name}`}
                onClose={onClose}
              />
            ) : (
              <NavLink
                key={child.id}
                to={`/projects/${projectId}/view/${child.id}`}
                onClick={onClose}
                className={({ isActive }) => cn(
                  'flex items-center gap-1.5 py-0.5 pr-1 rounded-md text-xs transition-colors',
                  isActive
                    ? 'text-primary font-medium bg-primary-soft'
                    : 'text-content-muted hover:bg-surface-hover hover:text-content'
                )}
              >
                <SidebarFileIcon name={child.name} />
                <span className="truncate" title={child.name}>{sidebarLabel(child.name)}</span>
              </NavLink>
            )
          )}
          {!loading && children.length === 0 && (
            <p className="py-0.5 text-xs text-content-subtle italic">비어있음</p>
          )}
        </div>
      )}
    </div>
  )
}

// 루트 트리 — 최상위 항목만 로드 후 FolderNode 재귀로 렌더
function SidebarFileTree({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [roots, setRoots] = useState<SFNode[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadFolder(projectId, '').then(items => {
      if (!cancelled) { setRoots(items); setReady(true) }
    })
    return () => { cancelled = true }
  }, [projectId])

  if (!ready) {
    return (
      <div className="flex items-center gap-1.5 py-1 text-xs text-content-subtle">
        <Loader2 size={10} className="animate-spin" />
      </div>
    )
  }
  if (!roots.length) {
    return <p className="py-1 text-xs text-content-subtle italic">파일 없음</p>
  }

  return (
    <div className="space-y-0.5">
      {roots.map(node =>
        node.isFolder ? (
          <FolderNode
            key={node.id}
            projectId={projectId}
            node={node}
            folderPath={node.name}
            onClose={onClose}
          />
        ) : (
          <NavLink
            key={node.id}
            to={`/projects/${projectId}/view/${node.id}`}
            onClick={onClose}
            className={({ isActive }) => cn(
              'flex items-center gap-1.5 py-0.5 pr-1 rounded-md text-xs transition-colors',
              isActive
                ? 'text-primary font-medium bg-primary-soft'
                : 'text-content-muted hover:bg-surface-hover hover:text-content'
            )}
          >
            <SidebarFileIcon name={node.name} />
            <span className="truncate" title={`${node.name}\n경로: ${folderPath || '루트'}`}>{sidebarLabel(node.name)}</span>
          </NavLink>
        )
      )}
    </div>
  )
}

/* ── 프로젝트 버튼 (WBS 진척률 포함) ── */
function ProjectButton({ project, isOpen, isActive, onClick }: {
  project: import('../../hooks/useProject').Project
  isOpen: boolean; isActive: boolean; onClick: () => void
}) {
  const pct = useWbsProgress(project.id, isOpen || isActive)
  const accent = project.themeColor ?? '#4f46e5'

  return (
    <button onClick={onClick}
      className={cn(
        'flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors',
        isActive ? 'bg-primary-soft text-primary font-medium' : 'text-content-muted hover:bg-surface-hover hover:text-content',
      )}
    >
      {isOpen ? <ChevronDown size={13} className="shrink-0 opacity-60" /> : <ChevronRight size={13} className="shrink-0 opacity-60" />}
      <ProjectLogo project={project} size={18} />
      <div className="flex-1 min-w-0">
        <div className="truncate text-xs">{project.name}</div>
        {project.systemCode && (
          <div className="text-[10px] font-mono opacity-60 leading-tight">{project.systemCode}</div>
        )}
        {/* WBS 진척률 바 */}
        {pct !== null && (
          <div className="flex items-center gap-1 mt-1">
            <div className="flex-1 h-1 bg-line rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all"
                   style={{ width: `${pct}%`, backgroundColor: isActive ? accent : '#94a3b8' }} />
            </div>
            <span className="text-[9px] opacity-60 shrink-0">{pct}%</span>
          </div>
        )}
      </div>
    </button>
  )
}

/* ── 메인 사이드바 ── */

export default function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: Props) {
  const location = useLocation()
  const { projects, loading } = useProjects()

  const activeProjectId = location.pathname.match(/\/projects\/([^/]+)/)?.[1] ?? null
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())

  // ── 사이드바 너비 조절 ─────────────────────────────────────────────────────
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    parseInt(localStorage.getItem('n2hub-sidebar-width') ?? '240')
  )
  const isResizing = useRef(false)
  const startX     = useRef(0)
  const startW     = useRef(0)

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    isResizing.current = true
    startX.current = e.clientX
    startW.current = sidebarWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current) return
      const next = Math.min(480, Math.max(180, startW.current + ev.clientX - startX.current))
      setSidebarWidth(next)
    }
    const onUp = () => {
      isResizing.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      localStorage.setItem('n2hub-sidebar-width', String(sidebarWidth))
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [sidebarWidth])

  // ── 메뉴 순서 (드래그앤드롭) ──────────────────────────────────────────────
  const [navOrder, setNavOrder]   = useState<string[]>(loadNavOrder)
  const [favorites, setFavorites] = useState<Set<string>>(loadFavorites)
  const [dragging, setDragging]   = useState<string | null>(null)
  const [dragOver, setDragOver]   = useState<string | null>(null)

  const toggleFavorite = (key: string) => {
    setFavorites(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      localStorage.setItem(FAV_KEY, JSON.stringify([...next]))
      return next
    })
  }

  const handleNavDrop = (targetKey: string) => {
    if (!dragging || dragging === targetKey) { setDragging(null); setDragOver(null); return }
    const next = [...navOrder]
    const fromIdx = next.indexOf(dragging)
    const toIdx   = next.indexOf(targetKey)
    next.splice(fromIdx, 1)
    next.splice(toIdx, 0, dragging)
    setNavOrder(next)
    localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(next))
    setDragging(null); setDragOver(null)
  }

  const orderedNavItems = navOrder
    .map(k => ALL_NAV_ITEMS.find(i => i.key === k))
    .filter(Boolean) as NavItemDef[]

  // 즐겨찾기 → 상단 고정, 나머지 → 아래
  const favItems    = orderedNavItems.filter(i => favorites.has(i.key))
  const nonFavItems = orderedNavItems.filter(i => !favorites.has(i.key))
  const sortedNavItems = [...favItems, ...nonFavItems]

  useEffect(() => {
    if (activeProjectId) setOpenIds(prev => new Set([...prev, activeProjectId]))
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
        'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-line bg-surface relative',
        'transition-[transform] duration-200 ease-out',
        collapsed ? 'w-16' : undefined,
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
        'lg:static lg:translate-x-0',
      )}
      style={collapsed ? undefined : { width: sidebarWidth }}
    >
      {/* 너비 조절 드래그 핸들 */}
      {!collapsed && (
        <div
          onMouseDown={onResizeStart}
          className="absolute top-0 right-0 w-1 h-full z-50 cursor-col-resize group hover:bg-primary/30 transition-colors"
          title="드래그하여 너비 조절"
        >
          <div className="absolute inset-y-0 -right-0.5 w-1 group-hover:bg-primary/40 rounded-full transition-colors" />
        </div>
      )}

      {/* 프로젝트 테마 틴트 오버레이 — 클릭 통과, 부드럽게 전환 */}
      <div
        className="absolute inset-0 pointer-events-none transition-colors duration-300 z-0"
        style={{ backgroundColor: 'var(--project-bg-sidebar, transparent)' }}
      />

      {/* 로고 */}
      <div className="relative z-10 flex h-14 shrink-0 items-center gap-2.5 border-b border-line px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
          N
        </div>
        {!collapsed && <span className="text-lg font-bold text-content">NEXT Hub</span>}
        <button
          onClick={onCloseMobile}
          className="ml-auto rounded-md p-1 text-content-muted hover:bg-surface-hover hover:text-content lg:hidden"
          aria-label="사이드바 닫기"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="relative z-10 flex-1 overflow-y-auto p-3 space-y-5">

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

            {/* 프로젝트 트리 (확장 상태) */}
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
                          <ProjectButton
                            project={project} isOpen={isOpen} isActive={isActive}
                            onClick={() => { toggleProject(project.id); onCloseMobile() }}
                          />

                          {/* 서브메뉴: 파일트리 + 링크 */}
                          {isOpen && (
                            <div className="ml-4 mt-1 mb-2 border-l-2 border-line pl-2.5">

                              {/* ── 드래그 가능한 메뉴 목록 (즐겨찾기 → 상단) ── */}
                              {sortedNavItems.map((item, idx) => {
                                const { key, icon: Icon, label } = item
                                const path      = `/projects/${project.id}/${key}`
                                const isDoc     = key === 'documents'
                                const isFav     = favorites.has(key)
                                const isDraggedOver = dragOver === key && dragging !== key
                                // 즐겨찾기→일반 경계선
                                const showDivider = idx === favItems.length && favItems.length > 0 && nonFavItems.length > 0

                                return (
                                  <div key={key}>
                                    {showDivider && <div className="my-1 border-t border-line/60" />}
                                    <div
                                      draggable
                                      onDragStart={() => setDragging(key)}
                                      onDragEnd={() => { setDragging(null); setDragOver(null) }}
                                      onDragOver={e => { e.preventDefault(); setDragOver(key) }}
                                      onDrop={() => handleNavDrop(key)}
                                      className={cn(
                                        'group/nav rounded-md transition-colors mb-0.5',
                                        isDraggedOver && 'border-t-2 border-primary',
                                        dragging === key && 'opacity-40',
                                      )}
                                    >
                                      {isDoc ? (
                                        <>
                                          <div className="flex items-center gap-0.5 group/docrow">
                                            <GripVertical size={10} className="shrink-0 text-content-subtle opacity-0 group-hover/docrow:opacity-60 cursor-grab" />
                                            <NavLink
                                              to={path} onClick={onCloseMobile} end
                                              className={({ isActive: a }) => cn(
                                                'flex flex-1 items-center gap-1.5 rounded-md px-1 py-1 text-xs font-semibold transition-colors',
                                                a ? 'bg-primary-soft text-primary' : 'text-content-muted hover:bg-surface-hover hover:text-content'
                                              )}
                                            >
                                              <Icon size={11} className="shrink-0" />
                                              <span>{label}</span>
                                            </NavLink>
                                            <button
                                              onClick={e => { e.stopPropagation(); toggleFavorite(key) }}
                                              className={cn(
                                                'shrink-0 p-0.5 rounded transition-all',
                                                isFav ? 'opacity-100 text-yellow-400' : 'opacity-0 group-hover/docrow:opacity-60 text-content-subtle hover:text-yellow-400'
                                              )}
                                              title={isFav ? '즐겨찾기 해제' : '즐겨찾기'}
                                            >
                                              <Star size={10} fill={isFav ? 'currentColor' : 'none'} />
                                            </button>
                                          </div>
                                          <div className="ml-4">
                                            <SidebarFileTree projectId={project.id} onClose={onCloseMobile} />
                                          </div>
                                        </>
                                      ) : (
                                        <div className="flex items-center gap-0.5 group/row">
                                          <GripVertical size={10} className="shrink-0 text-content-subtle opacity-0 group-hover/row:opacity-60 cursor-grab" />
                                          <NavLink
                                            to={path} onClick={onCloseMobile}
                                            className={({ isActive: a }) => cn(
                                              'flex flex-1 items-center gap-1.5 rounded px-1 py-1 text-xs transition-colors',
                                              a ? 'bg-primary-soft font-medium text-primary' : 'text-content-muted hover:bg-surface-hover hover:text-content'
                                            )}
                                          >
                                            <Icon size={11} className="shrink-0" />
                                            <span>{label}</span>
                                          </NavLink>
                                          <button
                                            onClick={e => { e.stopPropagation(); toggleFavorite(key) }}
                                            className={cn(
                                              'shrink-0 p-0.5 rounded transition-all',
                                              isFav ? 'opacity-100 text-yellow-400' : 'opacity-0 group-hover/row:opacity-60 text-content-subtle hover:text-yellow-400'
                                            )}
                                            title={isFav ? '즐겨찾기 해제' : '즐겨찾기'}
                                          >
                                            <Star size={10} fill={isFav ? 'currentColor' : 'none'} />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}

                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}

            {/* collapsed: 프로젝트 아이콘만 */}
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
      <div className="relative z-10 hidden border-t border-line p-3 lg:block">
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

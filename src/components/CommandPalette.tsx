import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, FileText, ClipboardList, Bug, X, Loader2, CornerDownLeft } from 'lucide-react'
import { useGlobalSearch, type SearchFile, type SearchTask, type SearchIssue } from '../hooks/useGlobalSearch'
import { cn } from '../utils'

type AnyResult = SearchFile | SearchTask | SearchIssue

// ── 우선순위 뱃지 색 ──────────────────────────────────────────────────────────
const PRI_CLS: Record<string, string> = {
  critical: 'bg-danger-soft text-red-700',
  high:     'bg-warning-soft text-orange-700',
  medium:   'bg-warning-soft text-yellow-700',
  low:      'bg-surface-hover text-slate-600',
}
const PRI_KO: Record<string, string> = {
  critical: '긴급', high: '높음', medium: '보통', low: '낮음',
}

// ── 결과 행 ───────────────────────────────────────────────────────────────────

function ResultRow({
  item, active, onClick,
}: { item: AnyResult; active: boolean; onClick: () => void }) {
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: 'nearest' })
  }, [active])

  return (
    <button
      ref={ref}
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
        active ? 'bg-primary-soft' : 'hover:bg-surface-hover',
      )}
    >
      {/* 아이콘 */}
      <span className={cn(
        'shrink-0 p-1.5 rounded-md',
        item.kind === 'file'  ? 'bg-primary-soft text-blue-600' :
        item.kind === 'task'  ? 'bg-success-soft text-green-600' :
        'bg-danger-soft text-red-600'
      )}>
        {item.kind === 'file'  ? <FileText size={12} /> :
         item.kind === 'task'  ? <ClipboardList size={12} /> :
         <Bug size={12} />}
      </span>

      {/* 내용 */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-content truncate">{item.name}</div>
        <div className="text-xs text-content-subtle truncate">
          {item.project_name || '프로젝트'}
          {item.kind === 'task' && ` · ${(item as SearchTask).wbs_code}`}
          {item.kind === 'issue' && ` · ${(item as SearchIssue).status}`}
        </div>
      </div>

      {/* 뱃지 */}
      {item.kind === 'issue' && (item as SearchIssue).priority && (
        <span className={cn(
          'shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium',
          PRI_CLS[(item as SearchIssue).priority] || 'bg-surface-hover text-slate-600'
        )}>
          {PRI_KO[(item as SearchIssue).priority] || (item as SearchIssue).priority}
        </span>
      )}

      {active && (
        <span className="shrink-0 text-content-subtle">
          <CornerDownLeft size={12} />
        </span>
      )}
    </button>
  )
}

// ── 섹션 헤더 ─────────────────────────────────────────────────────────────────

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between px-4 py-1.5 bg-surface">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-content-subtle">{label}</span>
      <span className="text-[10px] text-content-subtle">{count}</span>
    </div>
  )
}

// ── 메인 ──────────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void
}

export default function CommandPalette({ onClose }: Props) {
  const navigate = useNavigate()
  const { search } = useGlobalSearch()

  const [query, setQuery]       = useState('')
  const [files, setFiles]       = useState<SearchFile[]>([])
  const [tasks, setTasks]       = useState<SearchTask[]>([])
  const [issues, setIssues]     = useState<SearchIssue[]>([])
  const [loading, setLoading]   = useState(false)
  const [activeIdx, setActive]  = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 검색 디바운스
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!query.trim()) { setFiles([]); setTasks([]); setIssues([]); setLoading(false); return }
    setLoading(true)
    timerRef.current = setTimeout(async () => {
      const r = await search(query)
      setFiles(r.files); setTasks(r.tasks); setIssues(r.issues)
      setActive(0)
      setLoading(false)
    }, 300)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query, search])

  // 플랫 목록 (키보드 탐색용)
  const all: AnyResult[] = [...files, ...tasks, ...issues]

  // 결과 클릭/엔터 → 라우팅
  const navigate2 = useCallback((item: AnyResult) => {
    if (item.kind === 'file')  navigate(`/projects/${item.project_id}/view/${item.id}`)
    if (item.kind === 'task')  navigate(`/projects/${item.project_id}/tasks`)
    if (item.kind === 'issue') navigate(`/projects/${item.project_id}/issues`)
    onClose()
  }, [navigate, onClose])

  // 키보드 핸들러
  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') {
      e.preventDefault(); setActive(i => Math.min(i + 1, all.length - 1))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault(); setActive(i => Math.max(i - 1, 0))
    }
    if (e.key === 'Enter' && all[activeIdx]) {
      navigate2(all[activeIdx])
    }
  }, [all, activeIdx, navigate2, onClose])

  const isEmpty = !loading && query.trim() && all.length === 0

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh]" onKeyDown={handleKey}>
      {/* 배경 */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* 팔레트 */}
      <div className="relative w-full max-w-xl bg-canvas rounded-xl shadow-2xl border border-line overflow-hidden mx-4">

        {/* 검색 입력 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-line">
          {loading
            ? <Loader2 size={16} className="shrink-0 text-content-muted animate-spin" />
            : <Search size={16} className="shrink-0 text-content-muted" />}
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="문서, 작업, 이슈 검색…"
            className="flex-1 text-sm text-content bg-transparent placeholder-content-subtle outline-none"
          />
          <button onClick={onClose} className="p-1 rounded text-content-subtle hover:text-content-muted transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* 결과 */}
        <div className="max-h-[380px] overflow-y-auto">
          {!query.trim() && (
            <div className="flex flex-col items-center py-10 text-content-subtle text-xs gap-1">
              <Search size={20} className="mb-1 opacity-30" />
              문서, 작업, 이슈를 검색하세요
            </div>
          )}

          {isEmpty && (
            <div className="flex flex-col items-center py-10 text-content-subtle text-xs gap-1">
              <span className="text-2xl mb-1">🔍</span>
              "<span className="font-medium text-content-muted">{query}</span>" 검색 결과 없음
            </div>
          )}

          {/* 파일 */}
          {files.length > 0 && (
            <>
              <SectionHeader label="파일" count={files.length} />
              {files.map((item, i) => (
                <ResultRow
                  key={item.id} item={item}
                  active={activeIdx === i}
                  onClick={() => navigate2(item)}
                />
              ))}
            </>
          )}

          {/* 작업 */}
          {tasks.length > 0 && (
            <>
              <SectionHeader label="WBS 작업" count={tasks.length} />
              {tasks.map((item, i) => (
                <ResultRow
                  key={item.id} item={item}
                  active={activeIdx === files.length + i}
                  onClick={() => navigate2(item)}
                />
              ))}
            </>
          )}

          {/* 이슈 */}
          {issues.length > 0 && (
            <>
              <SectionHeader label="이슈" count={issues.length} />
              {issues.map((item, i) => (
                <ResultRow
                  key={item.id} item={item}
                  active={activeIdx === files.length + tasks.length + i}
                  onClick={() => navigate2(item)}
                />
              ))}
            </>
          )}
        </div>

        {/* 하단 힌트 */}
        <div className="flex items-center gap-3 px-4 py-2 border-t border-line bg-surface text-[10px] text-content-subtle">
          <span><kbd className="px-1 py-0.5 rounded bg-surface-hover border border-line font-mono">↑↓</kbd> 이동</span>
          <span><kbd className="px-1 py-0.5 rounded bg-surface-hover border border-line font-mono">Enter</kbd> 이동</span>
          <span><kbd className="px-1 py-0.5 rounded bg-surface-hover border border-line font-mono">Esc</kbd> 닫기</span>
        </div>
      </div>
    </div>
  )
}

import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ChevronDown, ChevronUp, GripHorizontal } from 'lucide-react'
import { useActionItems } from '../hooks/useActionItems'
import { cn } from '../utils'

const POS_KEY = 'n2hub-sticky-pos'

function loadPos(): { x: number; y: number } {
  try {
    const s = localStorage.getItem(POS_KEY)
    if (s) return JSON.parse(s)
  } catch { /* 무시 */ }
  // 기본 위치: 우측 하단
  return { x: window.innerWidth - 292, y: window.innerHeight - 320 }
}

export default function ActionItemSticky() {
  const { myPending, update } = useActionItems()
  const [collapsed, setCollapsed] = useState(false)
  const [checking, setChecking]   = useState<string | null>(null)
  const navigate = useNavigate()

  // ── 드래그 이동 ────────────────────────────────────────────────────────────
  const [pos, setPos]     = useState(loadPos)
  const dragging          = useRef(false)
  const startMouse        = useRef({ x: 0, y: 0 })
  const startPos          = useRef({ x: 0, y: 0 })

  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current   = true
    startMouse.current = { x: e.clientX, y: e.clientY }
    startPos.current   = { ...pos }
    document.body.style.userSelect = 'none'

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      const next = {
        x: Math.max(0, Math.min(window.innerWidth  - 280, startPos.current.x + ev.clientX - startMouse.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 100, startPos.current.y + ev.clientY - startMouse.current.y)),
      }
      setPos(next)
    }
    const onUp = () => {
      dragging.current = false
      document.body.style.userSelect = ''
      setPos(prev => { localStorage.setItem(POS_KEY, JSON.stringify(prev)); return prev })
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [pos])

  if (!myPending.length) return null

  const overdueCount = myPending.filter(i => i.dueDate && new Date(i.dueDate) < new Date()).length

  const handleCheck = async (id: string) => {
    setChecking(id)
    await update(id, { status: 'completed' })
    setChecking(null)
  }

  return (
    <div className="fixed z-40" style={{ left: pos.x, top: pos.y, width: 260 }}>
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, #fef08a 0%, #fde047 100%)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.6)',
        }}
      >
        {/* 헤더 */}
        <div
          className="flex items-center justify-between px-3 py-2.5 select-none"
          style={{ borderBottom: collapsed ? 'none' : '1px solid rgba(202,138,4,0.2)' }}
        >
          {/* 드래그 핸들 */}
          <div
            onMouseDown={onDragStart}
            className="flex items-center gap-1.5 cursor-grab active:cursor-grabbing flex-1 min-w-0"
          >
            <GripHorizontal size={13} className="text-yellow-700/50 shrink-0" />
            <span className="text-xs font-bold text-yellow-900 tracking-wide">내 할 일</span>
            <span
              className="text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1"
              style={{ background: overdueCount > 0 ? '#ef4444' : 'rgba(120,53,15,0.35)', color: 'white' }}
            >
              {myPending.length}
            </span>
            {overdueCount > 0 && (
              <span className="text-[10px] text-red-700 font-semibold truncate">{overdueCount}개 초과</span>
            )}
          </div>
          {/* 접기 버튼 */}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="text-yellow-700/70 hover:text-yellow-900 transition-colors shrink-0 p-0.5"
          >
            {collapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>

        {/* 아이템 목록 */}
        {!collapsed && (
          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            {myPending.map((item, i) => {
              const isOver   = item.dueDate && new Date(item.dueDate) < new Date()
              const daysLeft = item.dueDate
                ? Math.ceil((new Date(item.dueDate).getTime() - Date.now()) / 86_400_000)
                : null
              const isChecking = checking === item.id

              return (
                <div
                  key={item.id}
                  className="flex items-start gap-2.5 px-3.5 py-2.5 group hover:bg-yellow-300/30 transition-colors cursor-pointer"
                  style={{ borderBottom: i < myPending.length - 1 ? '1px solid rgba(202,138,4,0.15)' : 'none' }}
                >
                  {/* 체크박스 */}
                  <button
                    onClick={e => { e.stopPropagation(); handleCheck(item.id) }}
                    disabled={isChecking}
                    className={cn(
                      'shrink-0 mt-0.5 w-[15px] h-[15px] rounded-[4px] border-[1.5px] flex items-center justify-center transition-all duration-200',
                      isChecking
                        ? 'bg-yellow-600 border-yellow-600 scale-90'
                        : 'border-yellow-600/50 bg-white/40 hover:bg-white/70 hover:border-yellow-700',
                    )}
                  >
                    {isChecking && (
                      <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                        <path d="M1 3.5L3 5.5L8 1" stroke="#854d0e" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>

                  {/* 내용 */}
                  <div className="flex-1 min-w-0" onClick={() => navigate(`/projects/${item.projectId}/action-items`)}>
                    <p className="text-[12px] font-medium text-yellow-950 leading-snug line-clamp-2">
                      {item.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {item.dueDate && (
                        <span className={cn(
                          'text-[10px] font-medium',
                          isOver ? 'text-red-700' : daysLeft === 0 ? 'text-orange-700' : 'text-yellow-800/70',
                        )}>
                          {isOver ? `${Math.abs(daysLeft!)}일 초과` : daysLeft === 0 ? '오늘 마감' : `D-${daysLeft}`}
                        </span>
                      )}
                      {item.assigneeName && (
                        <span className="text-[10px] text-yellow-800/60">{item.assigneeName}</span>
                      )}
                    </div>
                  </div>

                  {/* X 버튼 */}
                  <button
                    onClick={e => { e.stopPropagation(); handleCheck(item.id) }}
                    className="shrink-0 opacity-0 group-hover:opacity-60 hover:!opacity-100 text-yellow-800 transition-opacity mt-0.5"
                  >
                    <X size={11} />
                  </button>
                </div>
              )
            })}

            {/* 하단 여백 + 접힌 모서리 효과 */}
            <div className="h-3" style={{ background: 'linear-gradient(180deg, transparent, rgba(161,98,7,0.06))' }} />
          </div>
        )}
      </div>

      {/* 접힌 모서리 효과 */}
      {!collapsed && (
        <div
          className="absolute bottom-0 right-0"
          style={{
            width: 0, height: 0,
            borderStyle: 'solid',
            borderWidth: '0 0 14px 14px',
            borderColor: 'transparent transparent rgba(161,98,7,0.25) transparent',
          }}
        />
      )}
    </div>
  )
}

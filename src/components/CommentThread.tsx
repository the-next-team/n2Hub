/**
 * CommentThread — 재사용 가능한 댓글 스레드 컴포넌트
 *
 * 사용법:
 *   <CommentThread projectId={id} targetType="task" targetId={taskId} />
 *   <CommentThread projectId={id} targetType="file" targetId={fileId} />
 */
import { useRef, useState, useEffect } from 'react'
import { MessageSquare, Send, Trash2, Loader2 } from 'lucide-react'
import { useComments } from '../hooks/useComments'
import { useAuth } from '../lib/auth'

// 상대 시간 포맷
function relTime(s: string): string {
  const diff = Date.now() - new Date(s).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '방금 전'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}일 전`
  return new Date(s).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

// 이름 이니셜 (아바타용)
function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

// 아바타 색상 (이름 해시 기반)
function avatarColor(name: string): string {
  const COLORS = [
    '#4f46e5','#0891b2','#059669','#d97706',
    '#dc2626','#7c3aed','#db2777','#0284c7',
  ]
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return COLORS[h % COLORS.length]
}

interface Props {
  projectId: string
  targetType: 'task' | 'file' | 'issue'
  targetId: string | null
  /** 패널 제목 (기본: "댓글") */
  title?: string
  /** 최대 높이 (기본: 400px) */
  maxHeight?: number
}

export default function CommentThread({
  projectId, targetType, targetId, title = '댓글', maxHeight = 400,
}: Props) {
  const { user } = useAuth()
  const { comments, loading, posting, error, post, remove } = useComments(projectId, targetType, targetId)
  const [body, setBody] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // 새 댓글 오면 스크롤 하단으로
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [comments.length])

  const handlePost = async () => {
    if (!body.trim() || posting) return
    const txt = body
    setBody('')
    try {
      await post(txt)
    } catch {
      setBody(txt)   // 실패 시 복원
    }
  }

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handlePost()
    }
  }

  if (!targetId) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-content-subtle text-xs">
        <MessageSquare size={20} className="mb-2" />
        작업을 선택하면 댓글을 볼 수 있습니다.
      </div>
    )
  }

  return (
    <div className="flex flex-col" style={{ maxHeight }}>
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-line shrink-0">
        <MessageSquare size={13} className="text-primary" />
        <span className="text-sm font-semibold text-content">{title}</span>
        {comments.length > 0 && (
          <span className="ml-1 text-xs text-content-muted">({comments.length})</span>
        )}
        {loading && <Loader2 size={11} className="animate-spin text-content-subtle ml-auto" />}
      </div>

      {/* 댓글 목록 */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0"
        style={{ maxHeight: maxHeight - 110 }}
      >
        {error && (
          <p className="text-xs text-danger bg-danger-soft rounded-lg px-3 py-2">{error}</p>
        )}
        {!loading && comments.length === 0 && (
          <div className="flex flex-col items-center py-6 text-content-subtle text-xs gap-1.5">
            <MessageSquare size={18} />
            첫 댓글을 달아보세요.
          </div>
        )}
        {comments.map(c => {
          const isMe = c.author_id === user?.id
          const color = avatarColor(c.author_name)
          return (
            <div key={c.id} className="flex gap-2.5 group">
              {/* 아바타 */}
              <div
                className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[9px] font-bold text-white mt-0.5"
                style={{ background: color }}
              >
                {initials(c.author_name)}
              </div>
              <div className="flex-1 min-w-0">
                {/* 작성자 + 시간 */}
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs font-semibold text-content">{c.author_name}</span>
                  <span className="text-[10px] text-content-subtle">{relTime(c.created_at)}</span>
                  {isMe && (
                    <button
                      onClick={() => remove(c.id)}
                      className="ml-auto opacity-0 group-hover:opacity-100 p-0.5 rounded text-content-subtle hover:text-danger hover:bg-danger-soft transition-all"
                    >
                      <Trash2 size={10} />
                    </button>
                  )}
                </div>
                {/* 본문 */}
                <p className="text-xs text-content mt-0.5 leading-relaxed whitespace-pre-wrap break-words">
                  {c.body}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* 입력 영역 */}
      <div className="shrink-0 border-t border-line px-3 py-2">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={body}
            onChange={e => setBody(e.target.value)}
            onKeyDown={handleKey}
            rows={2}
            placeholder="댓글 입력… (Enter로 전송, Shift+Enter 줄바꿈)"
            className="flex-1 text-xs px-3 py-2 rounded-lg border border-line bg-canvas text-content placeholder-content-subtle resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/60 transition"
          />
          <button
            onClick={handlePost}
            disabled={!body.trim() || posting}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-40 transition-colors shrink-0"
          >
            {posting
              ? <Loader2 size={13} className="animate-spin" />
              : <Send size={13} />
            }
          </button>
        </div>
      </div>
    </div>
  )
}

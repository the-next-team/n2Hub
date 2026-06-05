import { useState } from 'react'
import { MessageSquare, Send, Trash2, CornerDownRight } from 'lucide-react'
import { useDocumentComments } from '../hooks/useDocumentComments'
import type { DocumentComment } from '../types'
import { useAuth } from '../lib/auth'

interface Props {
  fileId: string
  projectId: string
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return '방금'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function initials(email: string) {
  return (email?.split('@')[0] ?? '?').slice(0, 2).toUpperCase()
}

function CommentItem({
  comment, currentUserId, onDelete, onReply,
}: {
  comment: DocumentComment
  currentUserId?: string
  onDelete: (id: string) => void
  onReply: (parentId: string, email: string) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2.5">
        {/* 아바타 */}
        <div className="w-7 h-7 rounded-full bg-primary-soft text-primary text-[11px] font-bold
                        flex items-center justify-center shrink-0 mt-0.5">
          {initials(comment.authorEmail ?? '')}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-medium text-content">
              {comment.authorEmail?.split('@')[0] ?? '알 수 없음'}
            </span>
            <span className="text-[10px] text-content-subtle">{timeAgo(comment.createdAt)}</span>
          </div>
          <p className="text-sm text-content mt-0.5 leading-relaxed">{comment.content}</p>
          <div className="flex items-center gap-3 mt-1">
            <button
              onClick={() => onReply(comment.id, comment.authorEmail ?? '')}
              className="text-[11px] text-content-subtle hover:text-primary flex items-center gap-1"
            >
              <CornerDownRight size={11} /> 답글
            </button>
            {comment.createdBy === currentUserId && (
              <button
                onClick={() => onDelete(comment.id)}
                className="text-[11px] text-content-subtle hover:text-danger flex items-center gap-1"
              >
                <Trash2 size={11} /> 삭제
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 답글 */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-9 pl-3 border-l border-line space-y-2">
          {comment.replies.map(reply => (
            <CommentItem
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              onDelete={onDelete}
              onReply={onReply}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function CommentPanel({ fileId, projectId }: Props) {
  const { user } = useAuth()
  const { comments, loading, posting, addComment, deleteComment, totalCount } = useDocumentComments(fileId, projectId)

  const [text, setText]         = useState('')
  const [replyTo, setReplyTo]   = useState<{ id: string; email: string } | null>(null)

  function handleReply(parentId: string, email: string) {
    setReplyTo({ id: parentId, email })
    setText(`@${email.split('@')[0]} `)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    await addComment(text, replyTo?.id)
    setText('')
    setReplyTo(null)
  }

  return (
    <div className="border border-line rounded-xl bg-surface flex flex-col" style={{ minHeight: 200 }}>
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-line shrink-0">
        <MessageSquare size={14} className="text-content-muted" />
        <span className="text-xs font-semibold text-content-muted uppercase tracking-wider">댓글</span>
        {totalCount > 0 && (
          <span className="ml-1 text-xs bg-primary text-white rounded-full px-1.5 py-0.5 font-medium">
            {totalCount}
          </span>
        )}
      </div>

      {/* 목록 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0" style={{ maxHeight: 320 }}>
        {loading ? (
          <p className="text-xs text-content-muted text-center py-4">로드 중...</p>
        ) : comments.length === 0 ? (
          <p className="text-xs text-content-muted text-center py-4">첫 댓글을 남겨보세요</p>
        ) : (
          comments.map(c => (
            <CommentItem
              key={c.id}
              comment={c}
              currentUserId={user?.id}
              onDelete={deleteComment}
              onReply={handleReply}
            />
          ))
        )}
      </div>

      {/* 입력 */}
      <form onSubmit={handleSubmit} className="px-4 pb-3 pt-2 border-t border-line shrink-0">
        {replyTo && (
          <div className="flex items-center gap-1 mb-1.5 text-xs text-primary bg-primary-soft px-2 py-1 rounded-lg">
            <CornerDownRight size={11} />
            <span>{replyTo.email.split('@')[0]} 에게 답글</span>
            <button type="button" onClick={() => { setReplyTo(null); setText('') }}
              className="ml-auto text-content-muted hover:text-content">✕</button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="댓글을 입력하세요... (@이름 으로 멘션)"
            className="flex-1 px-3 py-2 text-sm border border-line rounded-xl bg-canvas
                       focus:outline-none focus:ring-2 focus:ring-primary/30
                       text-content placeholder:text-content-subtle"
          />
          <button
            type="submit"
            disabled={posting || !text.trim()}
            className="p-2 bg-primary text-white rounded-xl hover:bg-primary-hover
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {posting ? <span className="animate-spin block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                     : <Send size={14} />}
          </button>
        </div>
      </form>
    </div>
  )
}

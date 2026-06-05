import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, X, Send, Loader2 } from 'lucide-react'
import { useActionItems } from '../hooks/useActionItems'
import { useMembers } from '../hooks/useMembers'

export default function ActionItemQuickAdd() {
  const { id: projectId } = useParams<{ id?: string }>()
  // projectId 없으면 훅은 호출하되 렌더링만 skip
  const { create }  = useActionItems(projectId)
  const { members } = useMembers(projectId ?? 'none')  // 빈문자열 방지
  const [open, setOpen]         = useState(false)
  const [title, setTitle]       = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [dueDate, setDueDate]   = useState('')
  const [saving, setSaving]     = useState(false)

  if (!projectId) return null

  const handleSave = async () => {
    if (!title.trim()) return
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
    <>
      {/* 플로팅 추가 버튼 */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-24 z-40 w-12 h-12 rounded-full bg-amber-500 text-white shadow-modal hover:bg-amber-600 transition-colors flex items-center justify-center"
        title="액션 아이템 빠른 등록"
      >
        <Plus size={22} />
      </button>

      {/* 빠른 입력 폼 */}
      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-80 bg-surface border border-line rounded-2xl shadow-modal overflow-hidden animate-fade-in-scale">
          <div className="flex items-center justify-between px-4 py-3 bg-amber-50 border-b border-amber-100">
            <span className="text-sm font-semibold text-amber-800">액션 아이템 등록</span>
            <button onClick={() => setOpen(false)} className="text-amber-600 hover:text-amber-800">
              <X size={16} />
            </button>
          </div>
          <div className="p-4 space-y-3">
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSave()}
              placeholder="해야 할 일 입력..."
              className="w-full px-3 py-2 border border-line rounded-lg text-sm bg-canvas focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 transition"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={assigneeId}
                onChange={e => setAssigneeId(e.target.value)}
                className="px-2 py-1.5 border border-line rounded-lg text-xs bg-canvas focus:outline-none focus:ring-2 focus:ring-amber-400/40 transition"
              >
                <option value="">담당자 선택</option>
                {members.map(m => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.display_name || m.email}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="px-2 py-1.5 border border-line rounded-lg text-xs bg-canvas focus:outline-none focus:ring-2 focus:ring-amber-400/40 transition"
              />
            </div>
            <button
              onClick={handleSave}
              disabled={!title.trim() || saving}
              className="w-full flex items-center justify-center gap-2 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              등록
            </button>
          </div>
        </div>
      )}
    </>
  )
}

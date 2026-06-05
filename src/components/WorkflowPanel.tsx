import { useState } from 'react'
import { CheckCircle2, ChevronRight, Clock, Lock, AlertCircle, History } from 'lucide-react'
import type { WorkflowStatus } from '../types'
import { WORKFLOW_STEPS, WORKFLOW_REQUIRES_APPROVAL } from '../types'
import { useWorkflow } from '../hooks/useWorkflow'

const STATUS_COLOR: Record<WorkflowStatus, string> = {
  '최초생성': 'bg-surface-hover text-content-muted border-line',
  '작성중':   'bg-warning-soft text-warning border-warning/30',
  '검토중':   'bg-primary-soft text-primary border-primary/30',
  '승인완료': 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/20 dark:text-purple-300',
  '완료':     'bg-success-soft text-success border-success/30',
}

interface Props {
  fileId: string
  projectId: string
  userRole?: string   // 'pm' | 'pl' | 'developer' | 'qa'
}

export default function WorkflowPanel({ fileId, projectId, userRole }: Props) {
  const {
    currentStatus, currentVersion, history, loading,
    transitioning, nextStep, isComplete, transition,
  } = useWorkflow(fileId, projectId)

  const [showModal, setShowModal]     = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [comment, setComment]         = useState('')
  const [commentError, setCommentError] = useState('')

  const canApprove = userRole === 'pm' || userRole === 'pl'

  function handleTransitionClick() {
    if (!nextStep) return
    if (WORKFLOW_REQUIRES_APPROVAL.includes(nextStep.status) && !canApprove) return
    setComment('')
    setCommentError('')
    setShowModal(true)
  }

  async function handleConfirm() {
    if (!nextStep) return
    if (!comment.trim()) {
      setCommentError('전환 사유를 입력해주세요')
      return
    }
    await transition(nextStep.status, comment)
    setShowModal(false)
    setComment('')
  }

  if (loading) return null

  const currentIdx = WORKFLOW_STEPS.findIndex(s => s.status === currentStatus)

  return (
    <>
      {/* ── 워크플로우 바 ── */}
      <div className="border border-line rounded-xl bg-surface p-4 space-y-3">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-content-muted uppercase tracking-wider">문서 워크플로우</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLOR[currentStatus]}`}>
              {currentStatus} {currentVersion}
            </span>
          </div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs text-content-muted hover:text-content flex items-center gap-1"
          >
            <History size={13} />
            이력
          </button>
        </div>

        {/* 스텝 표시 */}
        <div className="flex items-center gap-1">
          {WORKFLOW_STEPS.map((step, idx) => {
            const done    = idx < currentIdx
            const current = idx === currentIdx
            return (
              <div key={step.status} className="flex items-center gap-1 flex-1 min-w-0">
                <div className={`flex flex-col items-center gap-0.5 flex-1 min-w-0`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                    done    ? 'bg-success border-success text-white' :
                    current ? 'bg-primary border-primary text-white' :
                              'bg-canvas border-line text-content-subtle'
                  }`}>
                    {done ? <CheckCircle2 size={14} /> : idx + 1}
                  </div>
                  <span className={`text-[10px] leading-tight truncate w-full text-center ${
                    current ? 'text-primary font-semibold' :
                    done    ? 'text-success' : 'text-content-subtle'
                  }`}>{step.label}</span>
                  <span className={`text-[9px] ${current ? 'text-primary/70' : 'text-content-subtle'}`}>
                    {step.version}
                  </span>
                </div>
                {idx < WORKFLOW_STEPS.length - 1 && (
                  <ChevronRight size={12} className={`shrink-0 mb-3 ${done ? 'text-success' : 'text-line'}`} />
                )}
              </div>
            )
          })}
        </div>

        {/* 전환 버튼 */}
        {!isComplete && nextStep && (
          <div className="flex items-center justify-between pt-1 border-t border-line">
            {WORKFLOW_REQUIRES_APPROVAL.includes(nextStep.status) && !canApprove ? (
              <div className="flex items-center gap-1.5 text-xs text-content-muted">
                <Lock size={12} />
                <span>"{nextStep.label}" 전환은 PM·PL만 가능합니다</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-content-muted">다음 단계:</span>
                <span className="text-xs font-medium text-content">{nextStep.label} ({nextStep.version})</span>
              </div>
            )}
            <button
              onClick={handleTransitionClick}
              disabled={transitioning || (WORKFLOW_REQUIRES_APPROVAL.includes(nextStep.status) && !canApprove)}
              className="text-xs px-3 py-1.5 bg-primary text-white rounded-lg font-medium
                         hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {transitioning ? '처리 중...' : `→ ${nextStep.label}로 전환`}
            </button>
          </div>
        )}

        {isComplete && (
          <div className="flex items-center gap-2 pt-1 border-t border-line">
            <CheckCircle2 size={14} className="text-success" />
            <span className="text-xs text-success font-medium">최종 완료 (v1.0)</span>
          </div>
        )}

        {/* 이력 */}
        {showHistory && (
          <div className="pt-2 border-t border-line space-y-2 max-h-48 overflow-y-auto">
            {history.length === 0 && (
              <p className="text-xs text-content-muted text-center py-2">이력 없음</p>
            )}
            {history.map(h => (
              <div key={h.id} className="flex gap-2 text-xs">
                <Clock size={12} className="text-content-subtle mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <span className="text-content-muted">{h.authorEmail ?? h.changedBy}</span>
                  <span className="mx-1 text-content-subtle">·</span>
                  <span className="text-content">{h.fromStatus ?? '—'} → {h.toStatus}</span>
                  <span className="ml-1 text-content-subtle">({h.toVersion})</span>
                  {h.comment && <p className="text-content-muted mt-0.5 truncate">{h.comment}</p>}
                  <p className="text-content-subtle text-[10px]">
                    {new Date(h.changedAt).toLocaleString('ko-KR')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 전환 확인 모달 ── */}
      {showModal && nextStep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-surface rounded-2xl shadow-modal border border-line p-6 w-full max-w-md mx-4">
            <h3 className="text-base font-semibold text-content mb-1">단계 전환</h3>
            <p className="text-sm text-content-muted mb-4">
              <span className="font-medium text-content">{currentStatus}</span>
              <span className="mx-2">→</span>
              <span className="font-medium text-content">{nextStep.label}</span>
              <span className="ml-2 text-xs text-content-subtle">({currentVersion} → {nextStep.version})</span>
            </p>

            <div>
              <label className="block text-sm font-medium text-content mb-1.5">
                전환 사유 <span className="text-danger">*</span>
              </label>
              <textarea
                value={comment}
                onChange={e => { setComment(e.target.value); setCommentError('') }}
                placeholder="전환 사유를 입력하세요..."
                rows={3}
                className="w-full px-3 py-2 text-sm border border-line rounded-xl bg-canvas
                           focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none
                           text-content placeholder:text-content-subtle"
                autoFocus
              />
              {commentError && (
                <p className="flex items-center gap-1 mt-1 text-xs text-danger">
                  <AlertCircle size={12} /> {commentError}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-content-muted hover:text-content rounded-lg border border-line"
              >
                취소
              </button>
              <button
                onClick={handleConfirm}
                disabled={transitioning}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg font-medium
                           hover:bg-primary-hover disabled:opacity-50 transition-colors"
              >
                {transitioning ? '처리 중...' : '전환 확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

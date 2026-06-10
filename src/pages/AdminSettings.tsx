import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { Shield, Palette, Lock, Users, Loader2, Check, Crown } from 'lucide-react'
import { useWorkspace, useWorkspaceUsers } from '../hooks/useWorkspace'
import { useAuth } from '../lib/auth'
import { cn, formatDate } from '../utils'

export default function AdminSettings() {
  const { user } = useAuth()
  const { config, isAdmin, loading, updateConfig } = useWorkspace()
  const { users, loading: usersLoading, updateRole } = useWorkspaceUsers()

  const [appName, setAppName]   = useState(config.appName)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => { setAppName(config.appName) }, [config.appName])

  if (!loading && !isAdmin) return <Navigate to="/dashboard" replace />

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-content-subtle">
        <Loader2 size={24} className="animate-spin" />
      </div>
    )
  }

  async function save(patch: Parameters<typeof updateConfig>[0]) {
    setSaving(true); setError(''); setSaved(false)
    try {
      await updateConfig(patch)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError((err as Error).message)
    } finally { setSaving(false) }
  }

  async function handleRoleChange(userId: string, role: 'admin' | 'user') {
    if (userId === user?.id && role === 'user') {
      if (!confirm('본인의 관리자 권한을 해제하면 이 페이지에 다시 접근할 수 없습니다. 계속할까요?')) return
    }
    try { await updateRole(userId, role) }
    catch (err) { alert(`변경 실패: ${(err as Error).message}`) }
  }

  const sectionCls = 'bg-surface border border-line rounded-2xl p-6'
  const labelCls   = 'text-sm font-medium text-content'
  const descCls    = 'text-xs text-content-subtle mt-0.5'

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* 헤더 */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-soft flex items-center justify-center">
            <Shield size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-content">관리자 설정</h1>
            <p className="text-sm text-content-muted">워크스페이스 전역 설정 — 관리자에게만 보이는 메뉴입니다</p>
          </div>
          {saved && (
            <span className="ml-auto flex items-center gap-1 text-xs text-success">
              <Check size={14} /> 저장됨
            </span>
          )}
        </div>

        {error && (
          <div className="text-sm text-danger bg-danger-soft border border-danger/20 px-4 py-3 rounded-xl">{error}</div>
        )}

        {/* ── 브랜딩 ── */}
        <section className={sectionCls}>
          <div className="flex items-center gap-2 mb-4">
            <Palette size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-content">브랜딩</h2>
          </div>
          <label className={labelCls}>워크스페이스 이름</label>
          <p className={descCls}>좌측 상단 로고와 브라우저 탭에 표시됩니다.</p>
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              value={appName}
              onChange={e => setAppName(e.target.value)}
              maxLength={20}
              className="flex-1 px-3.5 py-2.5 border border-line rounded-xl text-sm bg-canvas focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="NEXT Hub"
            />
            <button
              onClick={() => save({ appName: appName.trim() || 'NEXT Hub' })}
              disabled={saving || appName.trim() === config.appName}
              className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover disabled:opacity-40 transition-colors"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : '적용'}
            </button>
          </div>
        </section>

        {/* ── 권한 정책 ── */}
        <section className={sectionCls}>
          <div className="flex items-center gap-2 mb-4">
            <Lock size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-content">권한 정책</h2>
          </div>
          <div className="space-y-5">
            {/* 프로젝트 생성 */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={labelCls}>프로젝트 생성</p>
                <p className={descCls}>새 프로젝트를 만들 수 있는 사용자 범위</p>
              </div>
              <select
                value={config.projectCreatePolicy}
                onChange={e => save({ projectCreatePolicy: e.target.value as 'all' | 'admin' })}
                className="px-3 py-2 border border-line rounded-xl text-sm bg-canvas focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="all">모든 사용자</option>
                <option value="admin">관리자만</option>
              </select>
            </div>
            {/* 프로젝트 삭제 */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={labelCls}>프로젝트 삭제</p>
                <p className={descCls}>프로젝트를 삭제할 수 있는 사용자 범위</p>
              </div>
              <select
                value={config.projectDeletePolicy}
                onChange={e => save({ projectDeletePolicy: e.target.value as 'owner' | 'admin' })}
                className="px-3 py-2 border border-line rounded-xl text-sm bg-canvas focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="owner">생성자 + 관리자</option>
                <option value="admin">관리자만</option>
              </select>
            </div>
            {/* 회원가입 허용 */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className={labelCls}>신규 회원가입 허용</p>
                <p className={descCls}>끄면 로그인 화면에서 회원가입이 숨겨집니다</p>
              </div>
              <button
                onClick={() => save({ allowSignup: !config.allowSignup })}
                className={cn(
                  'relative w-11 h-6 rounded-full transition-colors shrink-0',
                  config.allowSignup ? 'bg-primary' : 'bg-line',
                )}
                aria-label="회원가입 허용 토글"
              >
                <span className={cn(
                  'absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                  config.allowSignup ? 'translate-x-[22px]' : 'translate-x-0.5',
                )} />
              </button>
            </div>
          </div>
        </section>

        {/* ── 사용자 관리 ── */}
        <section className={sectionCls}>
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-primary" />
            <h2 className="text-sm font-semibold text-content">사용자 관리</h2>
            <span className="text-xs text-content-subtle">({users.length}명)</span>
          </div>
          {usersLoading ? (
            <div className="flex items-center gap-2 text-sm text-content-muted py-4">
              <Loader2 size={14} className="animate-spin" /> 불러오는 중...
            </div>
          ) : (
            <div className="divide-y divide-line">
              {users.map(u => (
                <div key={u.id} className="flex items-center gap-3 py-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary shrink-0">
                    {(u.display_name || u.email)[0].toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-content truncate flex items-center gap-1.5">
                      {u.display_name || u.email.split('@')[0]}
                      {u.role === 'admin' && <Crown size={12} className="text-amber-500 shrink-0" />}
                      {u.id === user?.id && <span className="text-[10px] text-content-subtle">(나)</span>}
                    </p>
                    <p className="text-xs text-content-subtle truncate">{u.email} · 가입 {formatDate(u.created_at)}</p>
                  </div>
                  <select
                    value={u.role}
                    onChange={e => handleRoleChange(u.id, e.target.value as 'admin' | 'user')}
                    className={cn(
                      'px-2.5 py-1.5 border rounded-lg text-xs bg-canvas focus:outline-none focus:ring-2 focus:ring-primary/40',
                      u.role === 'admin' ? 'border-amber-300 text-amber-700 font-medium' : 'border-line text-content-muted',
                    )}
                  >
                    <option value="user">일반</option>
                    <option value="admin">관리자</option>
                  </select>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

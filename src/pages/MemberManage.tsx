import { useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import {
  UserPlus, Trash2, Search, X, Pencil, Check, Shield,
  ClipboardList, Bug, ChevronDown, Loader2, AlertCircle, Plus,
} from 'lucide-react'
import { useProject } from '../hooks/useProject'
import {
  useMembers, ROLE_CFG,
  PERMISSION_LABELS, type MemberRole, type ProjectMember,
} from '../hooks/useMembers'
import { useRolePermissions } from '../hooks/useRolePermissions'
import { useProjectParts } from '../hooks/useProjectParts'
import { useAuth } from '../lib/auth'
import { PageHeader, Button } from '../components/ui'
import { cn } from '../utils'

// ── 상수 ──────────────────────────────────────────────────────────────────────
const ROLES: MemberRole[] = ['pm', 'pl', 'developer', 'qa']

// ── 아바타 ─────────────────────────────────────────────────────────────────────
function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const COLORS = ['#4f46e5','#0d9488','#d97706','#dc2626','#7c3aed','#0284c7','#15803d']
  const color  = COLORS[name.charCodeAt(0) % COLORS.length]
  return (
    <div className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
         style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.38 }}>
      {(name[0] ?? '?').toUpperCase()}
    </div>
  )
}

// ── 파트 관리 ─────────────────────────────────────────────────────────────────
function PartManager({
  parts, onAdd, onRemove,
}: { parts: string[]; onAdd: (n: string) => void; onRemove: (n: string) => void }) {
  const [input, setInput] = useState('')
  const [open, setOpen]   = useState(false)

  const handleAdd = () => {
    if (!input.trim()) return
    onAdd(input.trim()); setInput('')
  }

  return (
    <div className="mb-5 bg-surface border border-line rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-semibold text-content hover:bg-surface-hover transition-colors"
      >
        <span className="flex items-center gap-2">
          <ClipboardList size={15} className="text-content-subtle" />
          개발 파트 관리
          {parts.length > 0 && (
            <span className="text-xs font-normal text-content-subtle">{parts.length}개 등록됨</span>
          )}
        </span>
        <ChevronDown size={15} className={cn('text-content-subtle transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="px-5 pb-4 border-t border-line">
          {/* 파트 추가 */}
          <div className="flex gap-2 mt-3 mb-3">
            <input
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              placeholder="새 파트 이름 입력 (예: 뱅킹코어팀, PI팀)"
              className="flex-1 px-3 py-2 border border-line rounded-lg text-sm bg-canvas focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
            />
            <button onClick={handleAdd} disabled={!input.trim()}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-40">
              <Plus size={14} /> 추가
            </button>
          </div>

          {/* 등록된 파트 목록 */}
          {parts.length === 0 ? (
            <p className="text-xs text-content-subtle italic text-center py-2">등록된 파트가 없습니다.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {parts.map(p => (
                <div key={p} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-soft border border-primary/20 text-primary rounded-full text-xs font-medium">
                  {p}
                  <button onClick={() => onRemove(p)} className="text-primary/60 hover:text-danger transition-colors ml-0.5">
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── 역할별 권한 매트릭스 모달 ─────────────────────────────────────────────────
function RolePermissionModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { permissions, loading, saving, save, toggle, resetRole } = useRolePermissions(projectId)
  const resetAll = () => { const roles: MemberRole[] = ['pm', 'pl', 'developer', 'qa']; roles.forEach(resetRole) }
  const roles: MemberRole[] = ['pm', 'pl', 'developer', 'qa']

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-surface rounded-2xl shadow-modal w-full max-w-2xl animate-fade-in-scale flex flex-col max-h-[90vh]">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line shrink-0">
          <h2 className="text-base font-semibold text-content flex items-center gap-2">
            <Shield size={16} className="text-primary" /> 역할별 권한 설정
          </h2>
          <button onClick={onClose} className="text-content-subtle hover:text-content"><X size={18} /></button>
        </div>

        {/* 매트릭스 */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-content-subtle" /></div>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-canvas z-10">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-content-muted w-36 border-b border-line">권한</th>
                  {roles.map(r => (
                    <th key={r} className="px-4 py-3 text-center border-b border-line min-w-[100px]">
                      <span className={cn('text-[11px] font-bold px-2.5 py-1 rounded-full', ROLE_CFG[r].color)}>
                        {ROLE_CFG[r].label}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_LABELS.map(({ key, label }, i) => (
                  <tr key={key} className={i % 2 === 0 ? 'bg-canvas/50' : ''}>
                    <td className="px-4 py-3 text-sm text-content font-medium border-b border-line/50">
                      {label}
                    </td>
                    {roles.map(r => (
                      <td key={r} className="px-4 py-3 text-center border-b border-line/50">
                        <button
                          onClick={() => toggle(r, key)}
                          className={cn(
                            'w-8 h-8 rounded-lg border-2 flex items-center justify-center mx-auto transition-all',
                            permissions[r][key]
                              ? 'border-primary bg-primary text-white'
                              : 'border-line bg-canvas text-content-subtle hover:border-content-muted',
                          )}
                        >
                          {permissions[r][key] && <Check size={14} />}
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 푸터 */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-line bg-canvas shrink-0">
          <p className="text-xs text-content-subtle">변경사항은 해당 역할의 모든 멤버에게 즉시 적용됩니다.</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={resetAll}>기본값으로 복원</Button>
            <Button variant="secondary" onClick={onClose}>취소</Button>
            <Button onClick={() => save(permissions).then(onClose)} disabled={saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} 저장
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 멤버 카드 ──────────────────────────────────────────────────────────────────
function MemberCard({
  member, canEdit, isMe, parts, onUpdate, onRemove,
}: {
  member: ProjectMember; canEdit: boolean; isMe: boolean
  parts: string[]
  onUpdate: (patch: Parameters<ReturnType<typeof useMembers>['updateMember']>[1]) => Promise<void>
  onRemove: () => void
}) {
  const [editName, setEditName]   = useState(false)
  const [nameVal, setNameVal]     = useState(member.display_name ?? '')
  const [showRole, setShowRole]   = useState(false)
  const [showPart, setShowPart]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const roleRef = useRef<HTMLDivElement>(null)
  const partRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (roleRef.current && !roleRef.current.contains(e.target as Node)) setShowRole(false)
      if (partRef.current && !partRef.current.contains(e.target as Node)) setShowPart(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const save = async (patch: Parameters<typeof onUpdate>[0]) => {
    setSaving(true); try { await onUpdate(patch) } finally { setSaving(false) }
  }

  const { label: roleLabel, color: roleColor } = ROLE_CFG[member.role]
  const completionRate = member.taskCount ? Math.round((member.completedTaskCount ?? 0) / member.taskCount * 100) : 0

  return (
    <div className={cn(
      'bg-surface border border-line rounded-2xl p-5 transition-all hover:shadow-card hover:border-primary/20',
      isMe && 'ring-2 ring-primary/20',
    )}>
      {/* 상단: 아바타 + 이름 + 역할 */}
      <div className="flex items-start gap-3 mb-4">
        <Avatar name={member.display_name ?? member.email} size={44} />

        <div className="flex-1 min-w-0">
          {/* 이름 */}
          {editName ? (
            <div className="flex items-center gap-1.5 mb-1">
              <input
                autoFocus value={nameVal}
                onChange={e => setNameVal(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { save({ display_name: nameVal }); setEditName(false) }
                  if (e.key === 'Escape') setEditName(false)
                }}
                className="flex-1 px-2 py-1 text-sm border border-primary/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40 bg-canvas"
              />
              <button onClick={() => { save({ display_name: nameVal }); setEditName(false) }}
                className="p-1 rounded bg-primary text-white"><Check size={12} /></button>
              <button onClick={() => setEditName(false)} className="p-1 rounded text-content-subtle hover:bg-surface-hover"><X size={12} /></button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 mb-1">
              <span className="font-semibold text-content text-sm truncate">
                {member.display_name ?? member.email.split('@')[0]}
              </span>
              {isMe && <span className="text-[10px] px-1.5 py-0.5 bg-primary-soft text-primary rounded-full font-medium">나</span>}
              {(canEdit || isMe) && (
                <button onClick={() => setEditName(true)} className="opacity-0 group-hover:opacity-100 p-0.5 text-content-subtle hover:text-primary transition-all">
                  <Pencil size={11} />
                </button>
              )}
            </div>
          )}
          <p className="text-xs text-content-subtle truncate">{member.email}</p>
        </div>

        {/* 역할 드롭다운 */}
        <div ref={roleRef} className="relative shrink-0">
          <button
            onClick={() => canEdit && setShowRole(s => !s)}
            disabled={!canEdit}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors',
              roleColor,
              canEdit && 'hover:opacity-80 cursor-pointer',
            )}
          >
            {roleLabel}
            {canEdit && <ChevronDown size={10} />}
          </button>
          {showRole && (
            <div className="absolute right-0 top-full mt-1 z-20 w-36 bg-surface border border-line rounded-xl shadow-popover overflow-hidden">
              {ROLES.map(r => (
                <button key={r} onClick={() => { save({ role: r }); setShowRole(false) }}
                  className={cn(
                    'w-full text-left px-3 py-2 text-xs transition-colors hover:bg-surface-hover',
                    member.role === r && 'bg-primary-soft text-primary font-semibold',
                  )}>
                  <span className={cn('inline-block px-1.5 py-0.5 rounded-full text-[10px] font-bold mr-1.5', ROLE_CFG[r].color)}>
                    {ROLE_CFG[r].label}
                  </span>
                  {ROLE_CFG[r].desc}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 파트 선택 */}
      <div ref={partRef} className="relative mb-4">
        <button
          onClick={() => canEdit && setShowPart(s => !s)}
          className={cn(
            'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors w-full text-left',
            member.part
              ? 'border-primary/30 bg-primary-soft text-primary'
              : 'border-line text-content-subtle hover:border-content-muted',
            canEdit && 'cursor-pointer',
          )}
        >
          <span className="flex-1">{member.part ?? '파트 미지정'}</span>
          {canEdit && <ChevronDown size={10} />}
        </button>
        {showPart && (
          <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-surface border border-line rounded-xl shadow-popover overflow-hidden max-h-48 overflow-y-auto">
            <button onClick={() => { save({ part: null }); setShowPart(false) }}
              className="w-full text-left px-3 py-2 text-xs text-content-subtle hover:bg-surface-hover transition-colors italic">
              파트 미지정
            </button>
            {parts.length === 0 ? (
              <p className="px-3 py-2 text-xs text-content-subtle italic">파트를 먼저 등록해주세요</p>
            ) : parts.map(p => (
              <button key={p} onClick={() => { save({ part: p }); setShowPart(false) }}
                className={cn(
                  'w-full text-left px-3 py-2 text-xs transition-colors hover:bg-surface-hover',
                  member.part === p && 'bg-primary-soft text-primary font-semibold',
                )}>
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { icon: Bug, label: '이슈', val: member.issueCount ?? 0, color: 'text-orange-500' },
          { icon: ClipboardList, label: '태스크', val: member.taskCount ?? 0, color: 'text-primary' },
          { icon: Check, label: '완료율', val: `${completionRate}%`, color: 'text-success' },
        ].map(({ icon: Icon, label, val, color }) => (
          <div key={label} className="bg-canvas rounded-xl p-2.5 text-center">
            <Icon size={14} className={cn('mx-auto mb-1', color)} />
            <p className="text-xs font-bold text-content">{val}</p>
            <p className="text-[10px] text-content-subtle">{label}</p>
          </div>
        ))}
      </div>

      {/* 진행률 바 */}
      {(member.taskCount ?? 0) > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-[10px] text-content-subtle mb-1">
            <span>태스크 진행률</span>
            <span>{member.completedTaskCount}/{member.taskCount}</span>
          </div>
          <div className="h-1.5 bg-surface-hover rounded-full overflow-hidden">
            <div className="h-full bg-success rounded-full transition-all" style={{ width: `${completionRate}%` }} />
          </div>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
        {saving && <Loader2 size={13} className="animate-spin text-content-subtle" />}
        {(canEdit && !isMe) && (
          <button onClick={onRemove}
            className="p-1.5 rounded-lg text-content-subtle hover:text-danger hover:bg-danger-soft transition-colors">
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

// ── 메인 페이지 ────────────────────────────────────────────────────────────────
export default function MemberManage() {
  const { id: projectId } = useParams<{ id: string }>()
  const { user }    = useAuth()
  const { project } = useProject(projectId!)
  const { members, loading, error, findUserByEmail, searchProfiles, addMember, updateMember, removeMember } = useMembers(projectId!)

  const myMember  = members.find(m => m.user_id === user?.id)
  const isPM      = myMember?.role === 'pm' || project?.createdBy === user?.id
  const { parts, addPart, removePart } = useProjectParts(projectId!)

  // 추가 폼
  const [email, setEmail]         = useState('')
  const [role, setRole]           = useState<MemberRole>('developer')
  const [part, setPart]           = useState('')
  const [name, setName]           = useState('')
  const [adding, setAdding]       = useState(false)
  const [addErr, setAddErr]       = useState<string | null>(null)
  const [addOk, setAddOk]         = useState(false)
  const [showForm, setShowForm]   = useState(false)

  // 이름/이메일 자동완성
  const [suggestions, setSuggestions] = useState<{ id: string; email: string; display_name: string | null }[]>([])
  const [showSuggest, setShowSuggest] = useState(false)
  const [picked, setPicked]           = useState<{ id: string; email: string } | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef     = useRef<HTMLDivElement>(null)

  // 역할별 권한 모달
  const [showPermModal, setShowPermModal] = useState(false)

  // 검색
  const [search, setSearch] = useState('')
  const filtered = members.filter(m =>
    !search || (m.display_name ?? m.email).toLowerCase().includes(search.toLowerCase()) ||
    m.role.includes(search.toLowerCase()) || (m.part ?? '').includes(search)
  )

  useEffect(() => {
    const h = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setShowSuggest(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const onEmailChange = (v: string) => {
    setEmail(v); setPicked(null); setSuggestions([]); setShowSuggest(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (v.length >= 2) {
      debounceRef.current = setTimeout(async () => {
        const r = await searchProfiles(v)
        setSuggestions(r); setShowSuggest(r.length > 0)
      }, 300)
    }
  }
  const selectSuggestion = (p: { id: string; email: string; display_name: string | null }) => {
    setEmail(p.email); setName(p.display_name ?? ''); setPicked({ id: p.id, email: p.email }); setShowSuggest(false)
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault(); setAddErr(null)
    if (!email.trim() || !name.trim()) return
    setAdding(true)
    try {
      // 자동완성에서 선택한 사용자 우선, 아니면 정확한 이메일로 조회
      const found = picked ?? await findUserByEmail(email)
      if (!found) { setAddErr('사용자를 찾을 수 없습니다. 이름을 입력한 경우 검색 목록에서 선택해주세요.'); return }
      await addMember(found.id, found.email, role, name, part || undefined, {
        projectName: project?.name ?? '프로젝트',
        inviterName: user?.email?.split('@')[0] ?? '팀원',
      })
      setEmail(''); setName(''); setPart(''); setRole('developer'); setPicked(null); setAddOk(true); setShowForm(false)
      setTimeout(() => setAddOk(false), 3000)
    } catch (err) { setAddErr((err as Error).message) }
    finally { setAdding(false) }
  }

  const inputCls = 'w-full px-3 py-2 border border-line rounded-lg text-sm bg-canvas focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition'

  return (
    <div className="p-8 max-w-5xl">
      <PageHeader
        title="멤버 관리"
        description={`${members.length}명이 이 프로젝트에 참여 중입니다.`}
        actions={
          isPM && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setShowPermModal(true)}>
                <Shield size={16} /> 역할 권한 설정
              </Button>
              <Button onClick={() => setShowForm(s => !s)}>
                <UserPlus size={16} /> 멤버 초대
              </Button>
            </div>
          )
        }
      />

      {/* 파트 관리 */}
      {isPM && <PartManager parts={parts} onAdd={addPart} onRemove={removePart} />}

      {/* 성공 배너 */}
      {addOk && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-success-soft border border-success/20 rounded-xl text-sm text-success">
          <Check size={14} /> 멤버가 추가됐습니다.
        </div>
      )}

      {/* 초대 폼 */}
      {showForm && isPM && (
        <div className="mb-6 bg-surface border border-line rounded-2xl p-5 animate-fade-in">
          <h3 className="text-sm font-semibold text-content mb-4 flex items-center gap-2">
            <UserPlus size={15} className="text-primary" /> 새 멤버 초대
          </h3>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* 사용자 검색 (이름 또는 이메일) */}
              <div ref={wrapRef} className="relative col-span-2 sm:col-span-1">
                <label className="block text-xs font-medium text-content-muted mb-1">사용자 검색 *</label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-subtle" />
                  <input type="text" value={email} onChange={e => onEmailChange(e.target.value)}
                    placeholder="이름으로 검색 (예: 홍길동)" required className={inputCls + ' pl-8'} />
                  {email && <button type="button" onClick={() => { setEmail(''); setSuggestions([]); setPicked(null) }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-subtle hover:text-content">
                    <X size={14} />
                  </button>}
                </div>
                {showSuggest && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-surface border border-line rounded-xl shadow-popover overflow-hidden">
                    {suggestions.map(p => (
                      <button key={p.id} type="button" onMouseDown={() => selectSuggestion(p)}
                        className="w-full text-left px-3 py-2.5 hover:bg-surface-hover transition-colors border-b border-line last:border-0">
                        <div className="text-sm font-medium text-content">{p.display_name ?? p.email.split('@')[0]}</div>
                        <div className="text-xs text-content-subtle">{p.email}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 이름 */}
              <div>
                <label className="block text-xs font-medium text-content-muted mb-1">표시 이름 *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="예: 홍길동" required className={inputCls} />
              </div>

              {/* 역할 */}
              <div>
                <label className="block text-xs font-medium text-content-muted mb-1">역할 *</label>
                <select value={role} onChange={e => setRole(e.target.value as MemberRole)} className={inputCls}>
                  {ROLES.map(r => <option key={r} value={r}>{ROLE_CFG[r].label} — {ROLE_CFG[r].desc}</option>)}
                </select>
              </div>

              {/* 파트 */}
              <div>
                <label className="block text-xs font-medium text-content-muted mb-1">개발 파트</label>
                <select value={part} onChange={e => setPart(e.target.value)} className={inputCls}>
                  <option value="">파트 선택 (선택)</option>
                  {parts.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                {parts.length === 0 && (
                  <p className="text-xs text-content-subtle mt-1">↑ 상단 파트 관리에서 먼저 파트를 등록하세요</p>
                )}
              </div>
            </div>

            {addErr && (
              <p className="flex items-center gap-1.5 text-xs text-danger bg-danger-soft px-3 py-2 rounded-lg">
                <AlertCircle size={13} /> {addErr}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>취소</Button>
              <Button type="submit" disabled={adding || !email.trim() || !name.trim()}>
                {adding ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                초대
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* 검색 */}
      <div className="relative mb-6">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-subtle" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="이름, 역할, 파트로 검색..."
          className="w-full pl-9 pr-4 py-2 text-sm border border-line rounded-xl bg-surface focus:outline-none focus:ring-2 focus:ring-primary/40 transition" />
      </div>

      {/* 역할별 섹션 */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-content-subtle" /></div>
      ) : error ? (
        <p className="text-danger text-sm">{error}</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-content-subtle text-sm">멤버가 없습니다.</div>
      ) : (
        <div className="space-y-8">
          {ROLES.filter(r => filtered.some(m => m.role === r)).map(r => {
            const roleMembers = filtered.filter(m => m.role === r)
            const { label, color } = ROLE_CFG[r]
            return (
              <section key={r}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full', color)}>{label}</span>
                  <span className="text-xs text-content-subtle">{roleMembers.length}명</span>
                  <div className="flex-1 h-px bg-line" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {roleMembers.map(m => (
                    <div key={m.id} className="group">
                      <MemberCard
                        member={m}
                        canEdit={isPM}
                        isMe={m.user_id === user?.id}
                        parts={parts}
                        onUpdate={patch => updateMember(m.id, patch)}
                        onRemove={() => { if (confirm(`${m.display_name ?? m.email}를 제거할까요?`)) removeMember(m.id) }}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {/* 역할별 권한 매트릭스 모달 */}
      {showPermModal && (
        <RolePermissionModal projectId={projectId!} onClose={() => setShowPermModal(false)} />
      )}
    </div>
  )
}

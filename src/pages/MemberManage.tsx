import { useState, useRef, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ChevronRight, Users, UserPlus, Trash2, Crown,
  User, Loader2, AlertCircle, Search, X,
} from 'lucide-react'
import { useProject } from '../hooks/useProject'
import { useMembers } from '../hooks/useMembers'
import { useAuth } from '../lib/auth'
import type { ProjectMember } from '../hooks/useMembers'

const ROLE_LABEL = { pm: 'PM', member: '멤버' }
const ROLE_COLOR = {
  pm:     'bg-blue-100 text-blue-700',
  member: 'bg-gray-100 text-gray-600',
}

type ProfileResult = { id: string; email: string; display_name: string | null }

export default function MemberManage() {
  const { id: projectId } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { project } = useProject(projectId!)
  const {
    members, loading, error,
    findUserByEmail, searchProfiles, addMember, updateRole, removeMember,
  } = useMembers(projectId!)

  const myRole = members.find(m => m.user_id === user?.id)?.role
  const isPM = myRole === 'pm' || project?.createdBy === user?.id

  // 멤버 추가 폼
  const [email, setEmail]               = useState('')
  const [role, setRole]                 = useState<'pm' | 'member'>('member')
  const [displayName, setDisplayName]   = useState('')
  const [adding, setAdding]             = useState(false)
  const [addError, setAddError]         = useState<string | null>(null)
  const [addSuccess, setAddSuccess]     = useState(false)

  // 이메일 자동완성
  const [suggestions, setSuggestions]   = useState<ProfileResult[]>([])
  const [showSuggest, setShowSuggest]   = useState(false)
  const [searching, setSearching]       = useState(false)
  const debounceRef                     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef                      = useRef<HTMLDivElement>(null)

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggest(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleEmailChange(val: string) {
    setEmail(val)
    setAddError(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (val.length < 2) { setSuggestions([]); setShowSuggest(false); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      const results = await searchProfiles(val)
      setSuggestions(results)
      setShowSuggest(results.length > 0)
      setSearching(false)
    }, 300)
  }

  function selectSuggestion(p: ProfileResult) {
    setEmail(p.email)
    setDisplayName(p.display_name ?? '')
    setSuggestions([])
    setShowSuggest(false)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setAdding(true)
    setAddError(null)
    setAddSuccess(false)
    try {
      const found = await findUserByEmail(email)
      if (!found) { setAddError('해당 이메일로 가입된 계정이 없습니다.'); return }
      await addMember(found.id, found.email, role, displayName || found.display_name || undefined)
      setEmail('')
      setDisplayName('')
      setRole('member')
      setAddSuccess(true)
      setTimeout(() => setAddSuccess(false), 2500)
    } catch (err) {
      setAddError((err as Error).message)
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      {/* 브레드크럼 */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link to="/projects" className="hover:text-gray-700">프로젝트</Link>
        <ChevronRight size={14} />
        <Link to={`/projects/${projectId}`} className="hover:text-gray-700">
          {project?.name ?? '프로젝트 상세'}
        </Link>
        <ChevronRight size={14} />
        <span className="text-gray-900">멤버 관리</span>
      </div>

      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Users size={22} className="text-purple-600" />
          멤버 관리
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          프로젝트 멤버를 추가하고 역할을 설정합니다. PM은 전체 작업을 수정할 수 있습니다.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 rounded-lg flex items-center gap-2">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* 역할 안내 */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <div className="border border-blue-200 rounded-xl p-4 bg-blue-50">
          <div className="flex items-center gap-2 mb-2">
            <Crown size={16} className="text-blue-600" />
            <span className="font-semibold text-blue-800 text-sm">PM (프로젝트 매니저)</span>
          </div>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>• 전체 WBS 작업 수정</li>
            <li>• 담당자 지정/변경</li>
            <li>• WBS 가져오기</li>
            <li>• 멤버 관리</li>
          </ul>
        </div>
        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
          <div className="flex items-center gap-2 mb-2">
            <User size={16} className="text-gray-600" />
            <span className="font-semibold text-gray-700 text-sm">멤버</span>
          </div>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• 본인 담당 작업만 진행률 수정</li>
            <li>• 전체 작업 목록 조회</li>
            <li>• 산출물 파일 업로드/다운로드</li>
          </ul>
        </div>
      </div>

      {/* 멤버 추가 (PM만) */}
      {isPM && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <UserPlus size={16} className="text-gray-500" />
            멤버 추가
          </h2>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {/* 이메일 + 자동완성 */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">이메일 *</label>
                <div className="relative" ref={wrapperRef}>
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  {searching && (
                    <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
                  )}
                  {email && !searching && (
                    <button
                      type="button"
                      onClick={() => { setEmail(''); setSuggestions([]); setShowSuggest(false) }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                    >
                      <X size={13} />
                    </button>
                  )}
                  <input
                    type="text"
                    value={email}
                    onChange={e => handleEmailChange(e.target.value)}
                    onFocus={() => suggestions.length > 0 && setShowSuggest(true)}
                    placeholder="이메일 일부를 입력하세요"
                    autoComplete="off"
                    className="w-full pl-8 pr-7 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  {/* 자동완성 드롭다운 */}
                  {showSuggest && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                      {suggestions.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onMouseDown={() => selectSuggestion(p)}
                          className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0"
                        >
                          <div className="text-sm font-medium text-gray-800">
                            {p.display_name ?? p.email.split('@')[0]}
                          </div>
                          <div className="text-xs text-gray-400">{p.email}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">표시 이름 (선택)</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="예: 김철수"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">역할 *</label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as 'pm' | 'member')}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="member">멤버</option>
                  <option value="pm">PM</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={adding || !email.trim()}
                className="mt-5 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {adding ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                {adding ? '추가 중...' : '추가'}
              </button>
            </div>

            {addError && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle size={12} /> {addError}
              </p>
            )}
            {addSuccess && (
              <p className="text-xs text-green-600 font-medium">✓ 멤버가 추가됐습니다.</p>
            )}
          </form>
        </div>
      )}

      {/* 멤버 목록 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">
            현재 멤버 {loading ? '' : `(${members.length}명)`}
          </h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={24} className="animate-spin text-gray-300" />
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            <Users size={36} className="mx-auto mb-2 text-gray-200" />
            아직 추가된 멤버가 없습니다.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {members.map(member => (
              <MemberRow
                key={member.id}
                member={member}
                isMe={member.user_id === user?.id}
                isPM={isPM}
                onRoleChange={updateRole}
                onRemove={removeMember}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MemberRow({
  member, isMe, isPM, onRoleChange, onRemove,
}: {
  member: ProjectMember
  isMe: boolean
  isPM: boolean
  onRoleChange: (id: string, role: 'pm' | 'member') => Promise<void>
  onRemove: (id: string) => Promise<void>
}) {
  const [changing, setChanging] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [rowError, setRowError] = useState<string | null>(null)

  async function handleRoleChange(newRole: 'pm' | 'member') {
    setChanging(true)
    setRowError(null)
    try {
      await onRoleChange(member.id, newRole)
    } catch (err) {
      setRowError((err as Error).message)
    } finally {
      setChanging(false)
    }
  }

  async function handleRemove() {
    if (!confirm(`${member.display_name ?? member.email} 님을 멤버에서 제거할까요?`)) return
    setRemoving(true)
    setRowError(null)
    try {
      await onRemove(member.id)
    } catch (err) {
      setRowError((err as Error).message)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="px-5 py-3.5 hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-4">
        {/* 아바타 */}
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
          {(member.display_name ?? member.email)[0].toUpperCase()}
        </div>

        {/* 정보 */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 text-sm flex items-center gap-2">
            {member.display_name ?? member.email.split('@')[0]}
            {isMe && <span className="text-xs text-gray-400">(나)</span>}
          </div>
          <div className="text-xs text-gray-400 truncate">{member.email}</div>
        </div>

        {/* 역할 */}
        {isPM && !isMe ? (
          <select
            value={member.role}
            onChange={e => handleRoleChange(e.target.value as 'pm' | 'member')}
            disabled={changing}
            className="text-xs px-2 py-1 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="pm">PM</option>
            <option value="member">멤버</option>
          </select>
        ) : (
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${ROLE_COLOR[member.role]}`}>
            {member.role === 'pm' && <Crown size={10} className="inline mr-1" />}
            {ROLE_LABEL[member.role]}
          </span>
        )}

        {/* 삭제 버튼 (PM만, 자기 자신 제외) */}
        {isPM && !isMe && (
          <button
            onClick={handleRemove}
            disabled={removing}
            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
            title="멤버 제거"
          >
            {removing
              ? <Loader2 size={15} className="animate-spin" />
              : <Trash2 size={15} />
            }
          </button>
        )}
      </div>

      {/* 행 단위 에러 */}
      {rowError && (
        <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1 pl-13">
          <AlertCircle size={11} /> {rowError}
        </p>
      )}
    </div>
  )
}

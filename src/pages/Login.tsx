import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, User, ArrowRight, CheckCircle, FileText, Users, Zap } from 'lucide-react'
import { useAuth } from '../lib/auth'

const FEATURES = [
  { icon: FileText, text: '프로젝트 산출물 중앙 관리' },
  { icon: Users,    text: '팀 협업 및 버전 이력 관리' },
  { icon: Zap,      text: 'AI 문서 초안 자동 생성' },
]

export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [name, setName]         = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [signUpDone, setSignUpDone] = useState(false)
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (isSignUp) {
        if (!name.trim()) { setError('이름을 입력해주세요.'); setLoading(false); return }
        const { hasSession } = await signUp(email, password, name)
        // 이메일 인증 OFF → 가입 즉시 로그인됨
        if (hasSession) navigate('/dashboard')
        else setSignUpDone(true)
      } else {
        await signIn(email, password)
        navigate('/dashboard')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (signUpDone) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="w-full max-w-md bg-surface rounded-2xl shadow-modal border border-line p-10 text-center">
          <div className="w-14 h-14 bg-success-soft rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={28} className="text-success" />
          </div>
          <h2 className="text-lg font-semibold text-content mb-2">이메일을 확인하세요</h2>
          <p className="text-sm text-content-muted mb-6 leading-relaxed">
            <span className="font-medium text-content">{email}</span>으로<br />
            인증 링크를 보냈습니다.
          </p>
          <button
            onClick={() => { setIsSignUp(false); setSignUpDone(false) }}
            className="text-sm text-primary hover:underline font-medium"
          >
            로그인 화면으로 →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* ── 좌측 브랜드 패널 ── */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[520px] shrink-0 flex-col justify-between bg-primary px-14 py-16"
           style={{ background: 'linear-gradient(145deg, #4f46e5 0%, #3730a3 60%, #312e81 100%)' }}>
        {/* 로고 */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center text-white font-bold text-lg">
            N
          </div>
          <span className="text-white text-xl font-bold">NEXT Hub</span>
        </div>

        {/* 메인 카피 */}
        <div>
          <h1 className="text-white text-4xl font-bold leading-tight mb-4">
            산출물 관리의<br />새로운 기준
          </h1>
          <p className="text-white/70 text-base leading-relaxed mb-10">
            IT 프로젝트의 모든 산출물과 이슈를<br />
            한 곳에서 체계적으로 관리하세요.
          </p>

          {/* 기능 목록 */}
          <ul className="space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center shrink-0">
                  <Icon size={16} className="text-white" />
                </div>
                <span className="text-white/85 text-sm">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 하단 */}
        <p className="text-white/40 text-xs">© 2025 n2soft. All rights reserved.</p>
      </div>

      {/* ── 우측 폼 패널 ── */}
      <div className="flex-1 flex items-center justify-center bg-canvas px-6 py-12">
        <div className="w-full max-w-[400px]">

          {/* 모바일 로고 */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-sm">N</div>
            <span className="text-lg font-bold text-content">NEXT Hub</span>
          </div>

          {/* 제목 */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-content">
              {isSignUp ? '계정 만들기' : '다시 오셨군요 👋'}
            </h2>
            <p className="text-content-muted mt-1.5 text-sm">
              {isSignUp
                ? '아래 정보를 입력해 새 계정을 만드세요.'
                : '이메일과 비밀번호를 입력해 로그인하세요.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 이름 (회원가입 시에만) */}
            {isSignUp && (
              <div>
                <label className="block text-sm font-medium text-content mb-1.5">이름</label>
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-subtle" />
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-line rounded-xl text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors placeholder:text-content-subtle"
                    placeholder="홍길동"
                    required
                    maxLength={30}
                  />
                </div>
              </div>
            )}

            {/* 이메일 */}
            <div>
              <label className="block text-sm font-medium text-content mb-1.5">이메일</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-subtle" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-line rounded-xl text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors placeholder:text-content-subtle"
                  placeholder="you@example.com"
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* 비밀번호 */}
            <div>
              <label className="block text-sm font-medium text-content mb-1.5">비밀번호</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-subtle" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-line rounded-xl text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors placeholder:text-content-subtle"
                  placeholder="비밀번호를 입력하세요"
                  required
                />
              </div>
            </div>

            {/* 에러 */}
            {error && (
              <div className="flex items-start gap-2.5 text-sm text-danger bg-danger-soft border border-danger/20 px-3.5 py-3 rounded-xl">
                <span className="mt-0.5 shrink-0">⚠</span>
                <span>{error}</span>
              </div>
            )}

            {/* 제출 버튼 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-primary text-white rounded-xl font-medium text-sm hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                  </svg>
                  처리 중...
                </span>
              ) : (
                <>
                  {isSignUp ? '계정 만들기' : '로그인'}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* 전환 */}
          <p className="mt-6 text-center text-sm text-content-muted">
            {isSignUp ? '이미 계정이 있으신가요?' : '아직 계정이 없으신가요?'}{' '}
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError('') }}
              className="text-primary font-semibold hover:underline"
            >
              {isSignUp ? '로그인' : '회원가입'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

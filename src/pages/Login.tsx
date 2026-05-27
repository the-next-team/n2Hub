import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [signUpDone, setSignUpDone] = useState(false)
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (isSignUp) {
        await signUp(email, password)
        setSignUpDone(true)
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
        <div className="w-full max-w-md bg-surface rounded-xl shadow-sm border border-line p-8 text-center">
          <div className="text-4xl mb-4">✉️</div>
          <h2 className="text-lg font-semibold text-content mb-2">이메일을 확인하세요</h2>
          <p className="text-sm text-content-muted mb-6">
            {email} 으로 인증 링크를 보냈습니다.<br />
            이메일 확인 후 로그인해주세요.
          </p>
          <button
            onClick={() => { setIsSignUp(false); setSignUpDone(false) }}
            className="text-sm text-primary hover:underline"
          >
            로그인 화면으로
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas">
      <div className="w-full max-w-md bg-surface rounded-xl shadow-sm border border-line p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-content">n2Hub</h1>
          <p className="text-content-muted mt-1">IT 프로젝트 산출물 관리 플랫폼</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-content mb-1">이메일</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              placeholder="이메일을 입력하세요"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-content mb-1">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-line rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              placeholder="비밀번호를 입력하세요"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '처리 중...' : isSignUp ? '회원가입' : '로그인'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-content-muted">
          {isSignUp ? '이미 계정이 있으신가요?' : '아직 계정이 없으신가요?'}{' '}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError('') }}
            className="text-primary font-medium hover:underline"
          >
            {isSignUp ? '로그인' : '회원가입'}
          </button>
        </p>
      </div>
    </div>
  )
}

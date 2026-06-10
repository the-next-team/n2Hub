import { createContext, useContext, useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'

// ── Supabase 인증 오류 → 한글 메시지 변환 ──────────────────────────────────
const AUTH_ERROR_KO: [RegExp, string][] = [
  [/invalid login credentials/i,                  '이메일 또는 비밀번호가 올바르지 않습니다.'],
  [/email not confirmed/i,                        '이메일 인증이 완료되지 않았습니다. 관리자에게 문의해주세요.'],
  [/user already registered/i,                    '이미 가입된 이메일입니다. 로그인해주세요.'],
  [/email rate limit exceeded/i,                  '이메일 발송 한도를 초과했습니다. 잠시 후 다시 시도해주세요.'],
  [/over_email_send_rate_limit/i,                 '이메일 발송 한도를 초과했습니다. 잠시 후 다시 시도해주세요.'],
  [/password should be at least/i,                '비밀번호는 6자 이상이어야 합니다.'],
  [/unable to validate email|invalid format/i,    '이메일 형식이 올바르지 않습니다.'],
  [/signups? (is |are )?(disabled|not allowed)/i, '현재 회원가입이 비활성화되어 있습니다.'],
  [/for security purposes/i,                      '보안을 위해 잠시 후 다시 시도해주세요.'],
  [/failed to fetch|networkerror|network request/i, '네트워크 연결을 확인해주세요.'],
  [/new password should be different/i,           '새 비밀번호는 기존 비밀번호와 달라야 합니다.'],
  [/user not found/i,                             '존재하지 않는 계정입니다.'],
  [/session.*(expired|missing)|refresh token/i,   '로그인이 만료되었습니다. 다시 로그인해주세요.'],
]

export function translateAuthError(message: string): string {
  for (const [pattern, ko] of AUTH_ERROR_KO) {
    if (pattern.test(message)) return ko
  }
  return `오류가 발생했습니다. (${message})`
}

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  /** 반환값 hasSession: true면 즉시 로그인됨 (이메일 인증 OFF), false면 인증 메일 대기 */
  signUp: (email: string, password: string, displayName: string) => Promise<{ hasSession: boolean }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(translateAuthError(error.message))
  }

  async function signUp(email: string, password: string, displayName: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // raw_user_meta_data로 전달 → handle_new_user 트리거가 profiles.display_name에 저장
      options: { data: { display_name: displayName.trim() } },
    })
    if (error) throw new Error(translateAuthError(error.message))
    return { hasSession: !!data.session }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

import { createContext, useContext, useEffect, type ReactNode } from 'react'

// 사전 정의 테마 팔레트
export const THEME_PALETTE = [
  { label: '인디고 (기본)', value: '#4f46e5', hover: '#4338ca', soft: '#eef2ff' },
  { label: '블루',         value: '#2563eb', hover: '#1d4ed8', soft: '#eff6ff' },
  { label: '스카이',       value: '#0284c7', hover: '#0369a1', soft: '#f0f9ff' },
  { label: '틸',           value: '#0d9488', hover: '#0f766e', soft: '#f0fdfa' },
  { label: '그린',         value: '#16a34a', hover: '#15803d', soft: '#f0fdf4' },
  { label: '앰버',         value: '#d97706', hover: '#b45309', soft: '#fffbeb' },
  { label: '오렌지',       value: '#ea580c', hover: '#c2410c', soft: '#fff7ed' },
  { label: '레드',         value: '#dc2626', hover: '#b91c1c', soft: '#fef2f2' },
  { label: '핑크',         value: '#db2777', hover: '#be185d', soft: '#fdf2f8' },
  { label: '퍼플',         value: '#9333ea', hover: '#7e22ce', soft: '#faf5ff' },
  { label: '슬레이트',     value: '#475569', hover: '#334155', soft: '#f8fafc' },
  { label: '로즈',         value: '#e11d48', hover: '#be123c', soft: '#fff1f2' },
] as const

export type ThemeEntry = typeof THEME_PALETTE[number]

interface ProjectThemeContextValue {
  themeColor: string | null
}

const Ctx = createContext<ProjectThemeContextValue>({ themeColor: null })

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function ProjectThemeProvider({
  themeColor,
  children,
}: {
  themeColor: string | null
  children: ReactNode
}) {
  useEffect(() => {
    if (!themeColor) return
    // 다크모드 클래스 변경 감지 (토글 시 배경 재계산)
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains('dark')
      const entry = THEME_PALETTE.find(t => t.value === themeColor)
      const soft = entry?.soft ?? '#f8f8ff'
      if (isDark) {
        document.documentElement.style.setProperty('--project-bg',         hexToRgba(themeColor, 0.08))
        document.documentElement.style.setProperty('--project-bg-sidebar', hexToRgba(themeColor, 0.05))
      } else {
        document.documentElement.style.setProperty('--project-bg',         hexToRgba(soft, 0.55))
        document.documentElement.style.setProperty('--project-bg-sidebar', hexToRgba(soft, 0.30))
      }
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    const entry = THEME_PALETTE.find(t => t.value === themeColor)
    const hover = entry?.hover ?? themeColor
    const soft  = entry?.soft  ?? '#f8f8ff'

    document.documentElement.style.setProperty('--primary',       themeColor)
    document.documentElement.style.setProperty('--primary-hover', hover)
    document.documentElement.style.setProperty('--primary-soft',  soft)
    // 다크모드 여부 감지 → 다크모드는 primary 색상을 낮은 opacity로 사용
    const isDark = document.documentElement.classList.contains('dark')
    if (isDark) {
      document.documentElement.style.setProperty('--project-bg',         hexToRgba(themeColor, 0.08))
      document.documentElement.style.setProperty('--project-bg-sidebar', hexToRgba(themeColor, 0.05))
    } else {
      document.documentElement.style.setProperty('--project-bg',         hexToRgba(soft, 0.55))
      document.documentElement.style.setProperty('--project-bg-sidebar', hexToRgba(soft, 0.30))
    }

    return () => {
      observer.disconnect()
      document.documentElement.style.removeProperty('--primary')
      document.documentElement.style.removeProperty('--primary-hover')
      document.documentElement.style.removeProperty('--primary-soft')
      document.documentElement.style.removeProperty('--project-bg')
      document.documentElement.style.removeProperty('--project-bg-sidebar')
    }
  }, [themeColor])

  return <Ctx.Provider value={{ themeColor }}>{children}</Ctx.Provider>
}

export function useProjectTheme() {
  return useContext(Ctx)
}

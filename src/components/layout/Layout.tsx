import { useCallback, useEffect, useState } from 'react'
import { Outlet, useParams } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import CommandPalette from '../CommandPalette'
import { useUploadContext } from '../../contexts/UploadContext'
import { ProjectThemeProvider } from '../../contexts/ProjectThemeContext'
import { useProject } from '../../hooks/useProject'
import { Loader2 } from 'lucide-react'
import ActionItemSticky from '../ActionItemSticky'
import TodayTaskPanel from '../TodayTaskPanel'
import { useWorkspace } from '../../hooks/useWorkspace'
import { Component, type ReactNode } from 'react'

class SafeBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false }
  static getDerivedStateFromError() { return { error: true } }
  render() { return this.state.error ? null : this.props.children }
}

// 현재 프로젝트 테마를 읽어 Provider에 넘기는 내부 컴포넌트
function ProjectThemeLoader({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id?: string }>()
  const { project } = useProject(id ?? '')
  return (
    <ProjectThemeProvider themeColor={id ? (project?.themeColor ?? null) : null}>
      {children}
    </ProjectThemeProvider>
  )
}

const COLLAPSE_KEY = 'n2hub-sidebar-collapsed'
const THEME_KEY = 'n2hub-theme'

export default function Layout() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const [paletteOpen, setPaletteOpen] = useState(false)
  const { uploading, uploadProgress } = useUploadContext()
  const { config } = useWorkspace()

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  // 브라우저 탭 제목을 워크스페이스 이름과 동기화
  useEffect(() => {
    document.title = `${config.appName} — IT 산출물 관리 플랫폼`
  }, [config.appName])

  // Ctrl+K / Cmd+K → 커맨드 팔레트
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const toggleTheme = useCallback(() => {
    setDark(prev => {
      const next = !prev
      document.documentElement.classList.toggle('dark', next)
      localStorage.setItem(THEME_KEY, next ? 'dark' : 'light')
      return next
    })
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-canvas text-content">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(c => !c)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <ProjectThemeLoader>
        <div className="flex flex-1 flex-col overflow-hidden" style={{ background: 'var(--project-bg-sidebar, transparent)' }}>
          <Topbar dark={dark} onToggleTheme={toggleTheme} onOpenMobile={() => setMobileOpen(true)} />
          <main
            className="flex-1 overflow-auto flex flex-col transition-colors duration-300"
            style={{ background: 'var(--project-bg, transparent)' }}
          >
            <Outlet />
          </main>
        </div>
      </ProjectThemeLoader>

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      <SafeBoundary><ActionItemSticky /></SafeBoundary>
      <SafeBoundary><TodayTaskPanel /></SafeBoundary>

      {/* ── 전역 업로드 진행률 (페이지 이동해도 유지) ── */}
      {uploading && uploadProgress && (
        <div className="fixed bottom-6 right-6 z-50 w-80 bg-surface border border-line rounded-2xl shadow-modal p-4 animate-fade-in-scale">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-primary" />
              <span className="text-sm font-semibold text-content">업로드 중</span>
            </div>
            <span className="text-xs text-content-subtle">
              {uploadProgress.fileIndex} / {uploadProgress.fileCount}개
            </span>
          </div>
          <p className="text-xs text-content-muted truncate mb-2" title={uploadProgress.fileName}>
            {uploadProgress.fileName}
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-surface-hover rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-150"
                style={{ width: `${uploadProgress.percent}%` }}
              />
            </div>
            <span className="text-xs font-mono text-content-muted w-9 text-right shrink-0">
              {uploadProgress.percent}%
            </span>
          </div>
          {uploadProgress.fileCount > 1 && (
            <div className="mt-2.5">
              <div className="flex items-center justify-between text-xs text-content-subtle mb-1">
                <span>전체 진행</span>
                <span>
                  {Math.round(
                    ((uploadProgress.fileIndex - 1) / uploadProgress.fileCount) * 100 +
                    uploadProgress.percent / uploadProgress.fileCount
                  )}%
                </span>
              </div>
              <div className="h-1 bg-surface-hover rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary/40 rounded-full transition-all duration-150"
                  style={{
                    width: `${Math.round(
                      ((uploadProgress.fileIndex - 1) / uploadProgress.fileCount) * 100 +
                      uploadProgress.percent / uploadProgress.fileCount
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

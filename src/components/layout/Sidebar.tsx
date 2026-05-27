import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, FolderKanban, FileText, Settings, LogOut } from 'lucide-react'
import { useAuth } from '../../lib/auth'

const nav = [
  { to: '/dashboard', icon: LayoutDashboard, label: '대시보드' },
  { to: '/projects', icon: FolderKanban, label: '프로젝트' },
  { to: '/templates', icon: FileText, label: '템플릿' },
  { to: '/settings', icon: Settings, label: '설정' },
]

export default function Sidebar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <aside className="w-60 border-r border-gray-200 bg-white flex flex-col shrink-0">
      <div className="h-14 flex items-center px-6 border-b border-gray-200">
        <span className="font-bold text-lg text-blue-600">n2Hub</span>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-200">
        <div className="px-3 py-2 mb-1">
          <p className="text-xs text-gray-400 truncate">{user?.email}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut size={18} />
          로그아웃
        </button>
      </div>
    </aside>
  )
}

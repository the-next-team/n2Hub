import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { UploadProvider } from './contexts/UploadContext'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import ProjectList from './pages/ProjectList'
import ProjectDetail from './pages/ProjectDetail'
import DocumentList from './pages/DocumentList'
import DocumentEditor from './pages/DocumentEditor'
import FileViewer from './pages/FileViewer'
import TaskBoard from './pages/TaskBoard'
import GanttChart from './pages/GanttChart'
import IssueBoard from './pages/IssueBoard'
import CalendarView from './pages/CalendarView'
import ActivityLog from './pages/ActivityLog'
import MemberManage from './pages/MemberManage'
import TemplateManager from './pages/TemplateManager'
import AISearch from './pages/AISearch'
import SprintBoard from './pages/SprintBoard'
import ActionItemBoard from './pages/ActionItemBoard'
import MeetingRoom from './pages/MeetingRoom'
import Settings from './pages/Settings'
import Login from './pages/Login'

function ProtectedRoute() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="text-sm text-content-subtle">로딩 중...</div>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

function GuestRoute() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
      <UploadProvider>
        <Routes>
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<Login />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/projects" element={<ProjectList />} />
              <Route path="/projects/new" element={<ProjectList />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/projects/:id/documents" element={<DocumentList />} />
              <Route path="/projects/:id/view/:fileId" element={<FileViewer />} />
              <Route path="/projects/:id/tasks" element={<TaskBoard />} />
              <Route path="/projects/:id/gantt" element={<GanttChart />} />
              <Route path="/projects/:id/issues" element={<IssueBoard />} />
              <Route path="/projects/:id/ai-search" element={<AISearch />} />
              <Route path="/projects/:id/sprints"      element={<SprintBoard />} />
              <Route path="/projects/:id/action-items" element={<ActionItemBoard />} />
              <Route path="/projects/:id/meeting" element={<MeetingRoom />} />
              <Route path="/projects/:id/calendar" element={<CalendarView />} />
              <Route path="/projects/:id/activity" element={<ActivityLog />} />
              <Route path="/projects/:id/members" element={<MemberManage />} />
              <Route path="/documents/:docId" element={<DocumentEditor />} />
              <Route path="/templates" element={<TemplateManager />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Route>
        </Routes>
      </UploadProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

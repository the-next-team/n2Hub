import { User, Building2, Bell } from 'lucide-react'

const sections = [
  { icon: User, label: '계정 정보', desc: '이름, 이메일, 비밀번호' },
  { icon: Building2, label: '회사 정보', desc: '회사명, 로고 설정' },
  { icon: Bell, label: '알림 설정', desc: '이메일 알림 설정' },
]

export default function Settings() {
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-content">설정</h1>
        <p className="text-content-muted mt-1">계정과 서비스를 설정하세요.</p>
      </div>
      <div className="space-y-3 max-w-2xl">
        {sections.map(({ icon: Icon, label, desc }) => (
          <div
            key={label}
            className="flex items-center gap-4 bg-surface rounded-xl border border-line p-5 hover:border-blue-300 transition-colors cursor-pointer"
          >
            <div className="p-2 bg-surface-hover rounded-lg text-content-muted">
              <Icon size={20} />
            </div>
            <div>
              <div className="font-medium text-content">{label}</div>
              <div className="text-sm text-content-muted">{desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

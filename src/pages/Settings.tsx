import { User, Building2, Bell } from 'lucide-react'
import { Card, PageHeader } from '../components/ui'

const sections = [
  { icon: User, label: '계정 정보', desc: '이름, 이메일, 비밀번호' },
  { icon: Building2, label: '회사 정보', desc: '회사명, 로고 설정' },
  { icon: Bell, label: '알림 설정', desc: '이메일 알림 설정' },
]

export default function Settings() {
  return (
    <div className="p-8">
      <PageHeader className="mb-6" title="설정" description="계정과 서비스를 설정하세요." />
      <div className="space-y-3 max-w-2xl">
        {sections.map(({ icon: Icon, label, desc }) => (
          <Card
            key={label}
            className="flex items-center gap-4 p-5 hover:border-primary/40 transition-colors cursor-pointer"
          >
            <div className="p-2 bg-surface-hover rounded-lg text-content-muted">
              <Icon size={20} />
            </div>
            <div>
              <div className="font-medium text-content">{label}</div>
              <div className="text-sm text-content-muted">{desc}</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

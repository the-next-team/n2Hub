import { Plus, FileText } from 'lucide-react'
import { Button, Card, PageHeader } from '../components/ui'

const categories = ['요구사항', '설계', '개발', '테스트', '배포']

export default function TemplateManager() {
  return (
    <div className="p-8">
      <PageHeader
        className="mb-6"
        title="템플릿 관리"
        description="산출물 템플릿을 관리하세요."
        actions={
          <Button>
            <Plus size={16} />
            새 템플릿
          </Button>
        }
      />
      <div className="grid grid-cols-3 gap-4">
        {categories.map(cat => (
          <Card key={cat} className="p-5 hover:border-primary/40 transition-colors cursor-pointer">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-primary-soft rounded-lg text-primary">
                <FileText size={18} />
              </div>
              <span className="font-medium text-content">{cat}</span>
            </div>
            <p className="text-sm text-content-subtle">템플릿 없음</p>
          </Card>
        ))}
      </div>
    </div>
  )
}

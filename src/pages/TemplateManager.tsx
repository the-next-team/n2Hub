import { Plus, FileText } from 'lucide-react'

const categories = ['요구사항', '설계', '개발', '테스트', '배포']

export default function TemplateManager() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-content">템플릿 관리</h1>
          <p className="text-content-muted mt-1">산출물 템플릿을 관리하세요.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors">
          <Plus size={16} />
          새 템플릿
        </button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {categories.map(cat => (
          <div key={cat} className="bg-surface rounded-xl border border-line p-5 hover:border-blue-300 transition-colors cursor-pointer">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-primary-soft rounded-lg text-primary">
                <FileText size={18} />
              </div>
              <span className="font-medium text-content">{cat}</span>
            </div>
            <p className="text-sm text-content-subtle">템플릿 없음</p>
          </div>
        ))}
      </div>
    </div>
  )
}

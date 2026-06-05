import { useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Search, Sparkles, FileText, FileSpreadsheet, Presentation, File, Loader2, ExternalLink, ChevronRight, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { searchDocumentsByAI, analyzeDocumentContent } from '../lib/groq'
import { PageHeader } from '../components/ui'

interface FileRecord {
  id: string
  original_name: string
  folder_path: string
  mime_type: string
  storage_path: string
  size: number
}

interface SearchResult {
  file: FileRecord
  score: number
  reason: string
  deepExcerpt?: string
  deepScore?: number
}

function FileIcon({ name }: { name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (['docx','doc','odt','rtf','txt'].includes(ext)) return <FileText size={16} className="text-primary shrink-0" />
  if (['xlsx','xls','csv','ods'].includes(ext))        return <FileSpreadsheet size={16} className="text-green-500 shrink-0" />
  if (['pptx','ppt','odp'].includes(ext))              return <Presentation size={16} className="text-orange-500 shrink-0" />
  if (ext === 'pdf')                                   return <FileText size={16} className="text-red-500 shrink-0" />
  return <File size={16} className="text-content-subtle shrink-0" />
}

function ScoreDots({ score }: { score: number }) {
  return (
    <div className="flex gap-0.5" title={`관련도 ${score}/5`}>
      {[1,2,3,4,5].map(i => (
        <div key={i} className={`w-2 h-2 rounded-full ${i <= score ? 'bg-primary' : 'bg-line'}`} />
      ))}
    </div>
  )
}

async function extractText(file: FileRecord): Promise<string> {
  try {
    const { data, error } = await supabase.storage.from('documents').download(file.storage_path)
    if (error || !data) return ''
    const buffer = await data.arrayBuffer()
    const ext = file.original_name.split('.').pop()?.toLowerCase() ?? ''
    if (['docx','doc'].includes(ext)) {
      const mammoth = await import('mammoth')
      const { value } = await mammoth.extractRawText({ arrayBuffer: buffer })
      return value.slice(0, 5000)
    }
    if (['xlsx','xls','csv'].includes(ext)) {
      const XLSX = await import('xlsx')
      const wb   = XLSX.read(buffer, { type: 'buffer' })
      return wb.SheetNames.map(n => XLSX.utils.sheet_to_txt(wb.Sheets[n])).join('\n').slice(0, 5000)
    }
    if (['txt','md'].includes(ext)) {
      return new TextDecoder().decode(buffer).slice(0, 5000)
    }
    return ''
  } catch { return '' }
}

export default function AISearch() {
  const { id: projectId = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [query, setQuery]           = useState('')
  const [results, setResults]       = useState<SearchResult[]>([])
  const [phase, setPhase]           = useState<'idle' | 'name' | 'deep' | 'done'>('idle')
  const [deepProgress, setDeepProgress] = useState(0)
  const [deepTotal, setDeepTotal]   = useState(0)
  const cancelledRef = useRef(false)

  const handleCancel = useCallback(() => {
    cancelledRef.current = true
    setPhase('done')
  }, [])

  const handleSearch = useCallback(async () => {
    if (!query.trim() || !projectId) return

    cancelledRef.current = false
    setResults([])
    setPhase('name')

    // 1단계: 파일 목록 로드
    const { data: files } = await supabase
      .from('files')
      .select('id, original_name, folder_path, mime_type, storage_path, size')
      .eq('project_id', projectId)
      .neq('mime_type', 'folder')
      .order('original_name')

    if (!files?.length) { setPhase('done'); return }
    if (cancelledRef.current) return

    // 2단계: 파일명 정리 (버전·확장자 제거) → 토큰 절약
    const shortName = (f: FileRecord) => {
      const noExt = f.original_name.replace(/\.[a-zA-Z0-9]{2,6}$/, '')
      return noExt.replace(/_v?\d+[._][\w.]+$/i, '').slice(0, 50).trim()
    }

    // 전체 파일에서 최대 30개 선택 (최신순 + 키워드 우선)
    const qWords = query.toLowerCase().split(/\s+/).filter(w => w.length >= 2)
    const withScore = files.map(f => {
      const txt  = (f.original_name + f.folder_path).toLowerCase()
      const hits = qWords.filter(w => txt.includes(w)).length
      return { f, hits }
    }).sort((a, b) => b.hits - a.hits)

    const candidates = withScore.slice(0, 30).map(x => x.f)
    const nameDocs = candidates.map(f => ({ id: f.id, name: shortName(f), folderPath: f.folder_path }))

    let nameResults: Awaited<ReturnType<typeof searchDocumentsByAI>> = []
    try {
      nameResults = await searchDocumentsByAI(query, nameDocs)
    } catch (err) {
      console.error('AI 검색 오류:', err)
    }

    // AI 결과 없으면 클라이언트 키워드 매칭 폴백
    if (!nameResults.length && !cancelledRef.current) {
      const fallback = withScore.filter(x => x.hits > 0).slice(0, 10)
      if (fallback.length) {
        setResults(fallback.map(x => ({ file: x.f, score: x.hits * 2, reason: '파일명 키워드 일치' })))
      }
      setPhase('done')
      return
    }
    if (cancelledRef.current) return
    const topIds = new Set(nameResults.map(r => r.id))

    const initialResults: SearchResult[] = nameResults.map(r => ({
      file: files.find(f => f.id === r.id)!,
      score: r.score,
      reason: r.reason,
    })).filter(r => r.file)

    setResults(initialResults)

    // 3단계: 상위 결과 내용 심층 검색
    const deepCandidates = candidates.filter(f => topIds.has(f.id)).slice(0, 6)
    if (!deepCandidates.length) { setPhase('done'); return }

    setPhase('deep')
    setDeepTotal(deepCandidates.length)
    setDeepProgress(0)

    const deepResults: SearchResult[] = [...initialResults]

    for (let i = 0; i < deepCandidates.length; i++) {
      if (cancelledRef.current) break
      const file = deepCandidates[i]
      setDeepProgress(i + 1)
      try {
        const content = await extractText(file)
        if (!content || cancelledRef.current) continue
        const analysis = await analyzeDocumentContent(query, content, file.original_name)
        if (analysis.relevant && analysis.score >= 3) {
          const idx = deepResults.findIndex(r => r.file.id === file.id)
          if (idx >= 0) {
            deepResults[idx] = { ...deepResults[idx], deepScore: analysis.score, deepExcerpt: analysis.excerpt }
          }
        }
      } catch (err) {
        console.warn(`심층 분석 오류 (${file.original_name}):`, err)
      }
    }

    // 심층 점수 기반 재정렬
    deepResults.sort((a, b) => {
      const aS = a.deepScore ?? a.score
      const bS = b.deepScore ?? b.score
      return bS - aS
    })

    setResults([...deepResults])
    setPhase('done')
  }, [query, projectId])

  const isSearching = phase === 'name' || phase === 'deep'

  return (
    <div className="p-8 max-w-3xl">
      <PageHeader
        title="AI 문서 검색"
        description="찾고자 하는 내용을 자연어로 입력하면 AI가 관련 문서를 찾아드립니다."
      />

      {/* 검색창 */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-subtle" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !isSearching && handleSearch()}
            placeholder="예: 사용자 인증 요구사항, 배치 처리 설계, 테스트 케이스..."
            className="w-full pl-10 pr-4 py-3 border border-line rounded-xl text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
            disabled={isSearching}
          />
        </div>
        {isSearching ? (
          <button
            onClick={handleCancel}
            className="flex items-center gap-2 px-5 py-3 bg-danger text-white rounded-xl text-sm font-medium hover:bg-danger/90 transition-colors"
          >
            <X size={15} /> 취소
          </button>
        ) : (
          <button
            onClick={handleSearch}
            disabled={!query.trim()}
            className="flex items-center gap-2 px-5 py-3 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            <Sparkles size={15} /> AI 검색
          </button>
        )}
      </div>

      {/* 진행 상황 */}
      {phase === 'name' && (
        <div className="flex items-center gap-2 text-sm text-content-muted mb-4 p-3 bg-primary-soft rounded-xl">
          <Loader2 size={14} className="animate-spin text-primary" />
          파일 목록을 AI가 분석 중입니다...
        </div>
      )}
      {phase === 'deep' && (
        <div className="mb-4 p-3 bg-primary-soft rounded-xl">
          <div className="flex items-center justify-between text-sm text-content-muted mb-2">
            <span className="flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-primary" />
              문서 내용 심층 분석 중...
            </span>
            <span className="text-xs font-medium text-primary">{deepProgress} / {deepTotal}</span>
          </div>
          <div className="h-1.5 bg-primary-soft rounded-full overflow-hidden border border-primary/20">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${(deepProgress / deepTotal) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* 결과 */}
      {results.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-content">
              관련 문서 {results.length}개
              {phase === 'deep' && <span className="text-xs text-content-subtle ml-1">(심층 분석 중...)</span>}
            </p>
          </div>

          {results.map(r => (
            <div
              key={r.file.id}
              className="bg-surface border border-line rounded-xl p-4 hover:border-primary/40 hover:shadow-card transition-all cursor-pointer group"
              onClick={() => navigate(`/projects/${projectId}/view/${r.file.id}`)}
            >
              <div className="flex items-start gap-3">
                <FileIcon name={r.file.original_name} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-content truncate">{r.file.original_name}</p>
                      {r.file.folder_path && (
                        <p className="text-xs text-content-subtle mt-0.5 flex items-center gap-1">
                          <ChevronRight size={10} />{r.file.folder_path}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <ScoreDots score={r.deepScore ?? r.score} />
                      <ExternalLink size={13} className="text-content-subtle opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>

                  {/* AI 분석 이유 */}
                  <p className="text-xs text-content-muted mt-2 leading-relaxed">
                    <span className="text-primary font-medium">AI: </span>
                    {r.deepExcerpt ?? r.reason}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {phase === 'done' && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-content-subtle">
          <Search size={36} className="mb-3 opacity-20" />
          <p className="text-sm">관련 문서를 찾지 못했습니다.</p>
          <p className="text-xs mt-1">다른 검색어로 시도해보세요.</p>
        </div>
      )}
    </div>
  )
}

import { useState, useCallback, useEffect } from 'react'
import { Workbook } from '@fortune-sheet/react'
import '@fortune-sheet/react/dist/index.css'
import * as XLSX from 'xlsx'
import { Save, Download, Loader2, FileEdit, RefreshCw, CheckCircle2, Wifi } from 'lucide-react'
import { useGoogleDrive } from '../../hooks/useGoogleDrive'

// SheetJS 워크북 → FortuneSheet 형식 변환
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function xlsxToSheets(buffer: ArrayBuffer): any[] {
  const wb = XLSX.read(buffer, { type: 'array', cellStyles: true })
  return wb.SheetNames.map((name, idx) => {
    const ws = wb.Sheets[name]
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })
    const ref = ws['!ref']
    const range = ref ? XLSX.utils.decode_range(ref) : { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const celldata: any[] = []
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c })
        const cell = ws[addr]
        if (!cell) continue
        const val = cell.v ?? ''
        const isNum = cell.t === 'n'
        celldata.push({
          r, c,
          v: {
            v: val,
            m: cell.w ?? String(val),
            t: isNum ? 'n' : cell.t === 'b' ? 'b' : 'g',
            f: cell.f ? `=${cell.f}` : undefined,
          },
        })
      }
    }

    return {
      name,
      id: String(idx),
      index: String(idx),
      status: idx === 0 ? 1 : 0,
      order: String(idx),
      celldata,
      row: Math.max((aoa as unknown[][]).length + 20, 50),
      column: Math.max(range.e.c + 10, 26),
      defaultRowHeight: 19,
      defaultColWidth: 73,
      showGridLines: 1,
    }
  })
}

// FortuneSheet 형식 → SheetJS 워크북 → ArrayBuffer
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sheetsToXlsx(sheets: any[]): ArrayBuffer {
  const wb = XLSX.utils.book_new()
  for (const sheet of sheets) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cells = (sheet.celldata ?? []) as any[]
    if (cells.length === 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[]]), sheet.name)
      continue
    }
    const maxR = Math.max(...cells.map((c) => c.r)) + 1
    const maxC = Math.max(...cells.map((c) => c.c)) + 1
    const aoa: unknown[][] = Array.from({ length: maxR }, () => Array(maxC).fill(''))
    for (const cell of cells) {
      aoa[cell.r][cell.c] = cell.v?.v ?? ''
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), sheet.name)
  }
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}

interface Props {
  fileName: string
  buffer: ArrayBuffer
  onSave: (buffer: ArrayBuffer) => Promise<void>
  onDownload: () => void
}

export default function SpreadsheetEditor({ fileName, buffer, onSave, onDownload }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [sheets, setSheets] = useState<any[]>(() => xlsxToSheets(buffer))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const { working, syncing, error: driveError, driveFileId, autoSync, lastSynced, openInGoogle, syncNow } =
    useGoogleDrive()

  // "X초 전" 표시 갱신
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!lastSynced) return
    const t = setInterval(() => setTick(n => n + 1), 10_000)
    return () => clearInterval(t)
  }, [lastSynced])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setSaved(false)
    try {
      const buf = sheetsToXlsx(sheets)
      await onSave(buf)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }, [sheets, onSave])

  const handleOpenInSheets = () => openInGoogle(buffer, fileName, 'xlsx', onSave)

  function timeAgo(date: Date): string {
    const sec = Math.floor((Date.now() - date.getTime()) / 1000)
    if (sec < 60) return `${sec}초 전`
    if (sec < 3600) return `${Math.floor(sec / 60)}분 전`
    return `${Math.floor(sec / 3600)}시간 전`
  }

  return (
    <div className="flex flex-col h-full">
      {/* 툴바 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white shrink-0 gap-2 flex-wrap">
        <span className="text-sm font-medium text-gray-700 truncate max-w-xs hidden md:block">{fileName}</span>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {driveError && <span className="text-xs text-red-500 max-w-xs truncate">{driveError}</span>}

          {/* 지금 동기화 (Google Sheets 연결 중일 때) */}
          {driveFileId && (
            <button
              onClick={syncNow}
              disabled={syncing || working}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              지금 동기화
            </button>
          )}

          {/* Google Sheets로 편집 */}
          <button
            onClick={handleOpenInSheets}
            disabled={working}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {working ? <Loader2 size={14} className="animate-spin" /> : <FileEdit size={14} />}
            {working ? '업로드 중...' : driveFileId ? 'Google Sheets 다시 열기' : 'Google Sheets로 편집'}
          </button>

          <div className="w-px h-5 bg-gray-200" />

          <button
            onClick={onDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download size={14} />
            원본 다운로드
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? '저장 중...' : saved ? '저장됨 ✓' : '저장'}
          </button>
        </div>
      </div>

      {/* 자동 동기화 상태 배너 */}
      {autoSync && (
        <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-100 text-xs text-emerald-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wifi size={13} className="text-emerald-500" />
            <span>Google Sheets 자동 동기화 중 <span className="text-emerald-400">(30초마다)</span></span>
            {syncing && (
              <span className="flex items-center gap-1 text-green-600 font-medium">
                <Loader2 size={11} className="animate-spin" /> 동기화 중...
              </span>
            )}
          </div>
          {lastSynced && (
            <span className="flex items-center gap-1 text-emerald-600">
              <CheckCircle2 size={12} />
              마지막 동기화: {timeAgo(lastSynced)}
            </span>
          )}
        </div>
      )}

      {/* 스프레드시트 */}
      <div className="flex-1 min-h-0" style={{ width: '100%', height: '100%' }}>
        <Workbook
          data={sheets}
          onChange={setSheets}
          showToolbar
          showFormulaBar
          showSheetTabs
        />
      </div>
    </div>
  )
}

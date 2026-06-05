import { useState, useCallback, useEffect } from 'react'
import { Workbook } from '@fortune-sheet/react'
import '@fortune-sheet/react/dist/index.css'
import * as XLSX from 'xlsx'
import { Save, Download, Loader2, RefreshCw, CheckCircle2, Wifi, FileEdit } from 'lucide-react'
import { useGoogleDrive } from '../../hooks/useGoogleDrive'
import { Button } from '../ui'

// ── XLSX → FortuneSheet 변환 ──────────────────────────────────────────────────

// SheetJS 색상 → CSS hex
function toHex(color: { rgb?: string; theme?: number } | undefined): string | undefined {
  if (!color) return undefined
  if (color.rgb && color.rgb !== 'FF000000' && color.rgb !== '00000000') {
    // ARGB → RGB (앞 두 자리 투명도 제거)
    const rgb = color.rgb.length === 8 ? color.rgb.slice(2) : color.rgb
    return `#${rgb}`
  }
  return undefined
}

// SheetJS border style → FortuneSheet border
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapBorder(b: any) {
  if (!b) return undefined
  const styleMap: Record<string, number> = {
    thin: 1, medium: 2, thick: 3, dashed: 4, dotted: 5, double: 6,
    mediumDashed: 7, dashDot: 8, mediumDashDot: 9, dashDotDot: 10,
  }
  return { style: styleMap[b.style] ?? 1, color: toHex(b.color) ?? '#000000' }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCellStyle(cell: any): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s: any = cell?.s ?? {}
  const font   = s.font   ?? {}
  const fill   = s.fill   ?? {}
  const align  = s.alignment ?? {}
  const border = s.border ?? {}

  const style: Record<string, unknown> = {}

  // 글꼴
  if (font.bold)   style.bl = 1
  if (font.italic) style.it = 1
  if (font.underline) style.un = 1
  if (font.strike) style.cl = 1
  if (font.sz)     style.fs = font.sz   // pt
  if (font.name)   style.ff = font.name
  const fc = toHex(font.color)
  if (fc) style.fc = fc

  // 배경
  const bg = toHex(fill.fgColor) ?? toHex(fill.bgColor)
  if (bg && bg.toLowerCase() !== '#ffffff') style.bg = bg

  // 정렬 (horizontal: left=1 center=2 right=3; vertical: top=1 middle=0 bottom=2)
  const hMap: Record<string, number> = { left: 1, center: 2, right: 3, general: 1 }
  const vMap: Record<string, number> = { top: 1, middle: 0, center: 0, bottom: 2 }
  if (align.horizontal) style.ht = hMap[align.horizontal] ?? 1
  if (align.vertical)   style.vt = vMap[align.vertical] ?? 0
  if (align.wrapText)   style.tb = 2  // 자동 줄바꿈

  // 테두리
  const bd: Record<string, unknown> = {}
  const t = mapBorder(border.top)
  const b = mapBorder(border.bottom)
  const l = mapBorder(border.left)
  const r = mapBorder(border.right)
  if (t) bd.t = t
  if (b) bd.b = b
  if (l) bd.l = l
  if (r) bd.r = r
  if (Object.keys(bd).length) style.bd = bd

  return style
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function xlsxToSheets(buffer: ArrayBuffer): any[] {
  const wb = XLSX.read(buffer, {
    type: 'array',
    cellStyles: true,
    cellDates: true,
    cellNF: true,
  })

  return wb.SheetNames.map((name, idx) => {
    const ws = wb.Sheets[name]
    const ref = ws['!ref']
    const range = ref ? XLSX.utils.decode_range(ref) : { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } }

    // ── 셀 데이터 ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const celldata: any[] = []
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c })
        const cell = ws[addr]
        if (!cell) continue

        const val = cell.v ?? ''
        const isNum  = cell.t === 'n'
        const isBool = cell.t === 'b'
        const isDate = cell.t === 'd'

        const v: Record<string, unknown> = {
          v: val,
          m: cell.w ?? String(val),
          t: isNum ? 'n' : isBool ? 'b' : isDate ? 'd' : 'g',
          ...mapCellStyle(cell),
        }

        if (cell.f) v.f = `=${cell.f}`
        if (cell.z) v.fm = cell.z  // 숫자 포맷

        celldata.push({ r, c, v })
      }
    }

    // ── 병합 셀 ──
    const merges = ws['!merges'] ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const merge: Record<string, any> = {}
    for (const m of merges) {
      const key = `${m.s.r}_${m.s.c}`
      const rs = m.e.r - m.s.r + 1
      const cs = m.e.c - m.s.c + 1
      merge[key] = { r: m.s.r, c: m.s.c, rs, cs }
      // 병합된 자식 셀에 mc: true 표시
      for (let r = m.s.r; r <= m.e.r; r++) {
        for (let c = m.s.c; c <= m.e.c; c++) {
          if (r === m.s.r && c === m.s.c) continue
          const child = celldata.find(cd => cd.r === r && cd.c === c)
          if (child) {
            child.v = { ...(child.v ?? {}), mc: true }
          } else {
            celldata.push({ r, c, v: { mc: true } })
          }
        }
      }
    }

    // ── 컬럼 너비 ──
    const rawCols = ws['!cols'] ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const colLen: Record<string, any> = {}
    rawCols.forEach((col: XLSX.ColInfo, i: number) => {
      if (col) {
        const width = col.wpx ?? (col.wch ? col.wch * 7 : undefined) ?? 73
        colLen[i] = { size: Math.round(width) }
      }
    })

    // ── 행 높이 ──
    const rawRows = ws['!rows'] ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rowLen: Record<string, any> = {}
    rawRows.forEach((row: XLSX.RowInfo, i: number) => {
      if (row) {
        const height = row.hpx ?? (row.hpt ? row.hpt * 1.333 : undefined) ?? 19
        rowLen[i] = { size: Math.round(height) }
      }
    })

    return {
      name,
      id: String(idx),
      index: String(idx),
      status: idx === 0 ? 1 : 0,
      order: String(idx),
      celldata,
      merge,
      colLen,
      rowLen,
      row: Math.max(range.e.r + 20, 50),
      column: Math.max(range.e.c + 10, 26),
      defaultRowHeight: 19,
      defaultColWidth: 73,
      showGridLines: 1,
    }
  })
}

// ── FortuneSheet → XLSX 역변환 ─────────────────────────────────────────────
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
      if (!cell.v?.mc) aoa[cell.r][cell.c] = cell.v?.v ?? ''
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), sheet.name)
  }
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}

// ── 컴포넌트 ────────────────────────────────────────────────────────────────
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
  const [saved,  setSaved]  = useState(false)

  const { working, syncing, error: driveError, driveFileId, autoSync, lastSynced, openInGoogle, syncNow } =
    useGoogleDrive()

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
    if (sec < 60)   return `${sec}초 전`
    if (sec < 3600) return `${Math.floor(sec / 60)}분 전`
    return `${Math.floor(sec / 3600)}시간 전`
  }

  return (
    <div className="light-island flex flex-col h-full bg-canvas">
      {/* 툴바 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-line bg-surface shrink-0 gap-2 flex-wrap">
        <span className="text-sm font-medium text-content-muted truncate max-w-xs hidden md:block">{fileName}</span>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {driveError && <span className="text-xs text-danger max-w-xs truncate">{driveError}</span>}

          {driveFileId && (
            <Button variant="secondary" size="sm" onClick={syncNow} disabled={syncing || working}>
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              지금 동기화
            </Button>
          )}

          <button
            onClick={handleOpenInSheets}
            disabled={working}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {working ? <Loader2 size={14} className="animate-spin" /> : <FileEdit size={14} />}
            {working ? '업로드 중...' : driveFileId ? 'Google Sheets 다시 열기' : 'Google Sheets로 편집'}
          </button>

          <div className="w-px h-5 bg-line" />

          <Button variant="secondary" size="sm" onClick={onDownload}>
            <Download size={14} />
            원본 다운로드
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving
              ? <Loader2 size={14} className="animate-spin" />
              : saved
                ? <CheckCircle2 size={14} />
                : <Save size={14} />}
            {saving ? '저장 중...' : saved ? '저장됨 ✓' : '저장'}
          </Button>
        </div>
      </div>

      {/* Google Sheets 자동 동기화 배너 */}
      {autoSync && (
        <div className="px-4 py-2 bg-emerald-50 border-b border-emerald-100 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wifi size={13} className="text-emerald-500" />
            <span>Google Sheets 자동 동기화 중 <span className="text-emerald-400">(30초마다)</span></span>
            {syncing && (
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400 font-medium">
                <Loader2 size={11} className="animate-spin" /> 동기화 중...
              </span>
            )}
          </div>
          {lastSynced && (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
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

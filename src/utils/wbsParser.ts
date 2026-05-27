import * as XLSX from 'xlsx'

export interface WbsTask {
  wbs_code: string
  wbs_level: number
  task_name: string
  start_date: string | null
  end_date: string | null
  planned_progress: number
  actual_progress: number
  assignee_name: string | null
  status: 'not_started' | 'in_progress' | 'completed' | 'delayed'
}

function toDateString(val: unknown): string | null {
  if (val == null) return null
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null
    return val.toISOString().split('T')[0]
  }
  if (typeof val === 'number') {
    // Excel serial date → JS date
    const ms = Math.round((val - 25569) * 86400 * 1000)
    const d = new Date(ms)
    if (isNaN(d.getTime())) return null
    return d.toISOString().split('T')[0]
  }
  if (typeof val === 'string') {
    const d = new Date(val)
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  }
  return null
}

function computeStatus(
  actual: number,
  planned: number,
  endDate: string | null,
): WbsTask['status'] {
  if (actual >= 1) return 'completed'
  if (actual > 0) return 'in_progress'
  const today = new Date().toISOString().split('T')[0]
  if (endDate && endDate < today && planned > 0) return 'delayed'
  return 'not_started'
}

const IGNORED_ASSIGNEES = new Set(['[담당자미지정]', 'CN', ''])

/**
 * ArrayBuffer(xlsx/xlsm) → WbsTask[]
 * Schedule 시트 기준으로 파싱
 */
export function parseWbsBuffer(buffer: ArrayBuffer): WbsTask[] {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })

  // Schedule 시트 찾기
  const scheduleName = wb.SheetNames.find(
    n => n === 'Schedule' || n.toLowerCase() === 'schedule',
  )
  if (!scheduleName) {
    throw new Error('Schedule 시트를 찾을 수 없습니다. WBS 파일이 맞는지 확인하세요.')
  }

  const ws = wb.Sheets[scheduleName]
  // header: 1 → 2차원 배열, defval: null
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null })

  // 헤더 4줄 건너뜀 (row 0~3), 데이터는 row 4부터
  const tasks: WbsTask[] = []

  for (let i = 4; i < aoa.length; i++) {
    const row = aoa[i] as unknown[]
    if (!row) continue

    const wbsLevel = row[2]
    if (wbsLevel !== 1 && wbsLevel !== 2 && wbsLevel !== 3) continue

    const wbsCode = row[3]
    if (wbsCode == null) continue

    // 레벨별 작업명 열: L1=col4, L2=col5, L3=col6
    let taskName: string | null = null
    if (wbsLevel === 1) taskName = row[4] as string | null
    else if (wbsLevel === 2) taskName = row[5] as string | null
    else if (wbsLevel === 3) taskName = row[6] as string | null

    if (!taskName) continue

    const startDate = toDateString(row[12])   // col12 = 시작일*
    const endDate   = toDateString(row[13])   // col13 = 완료일*
    const assigneeRaw = row[26] as string | null | undefined  // col26 = 담당
    const assignee = assigneeRaw && !IGNORED_ASSIGNEES.has(String(assigneeRaw).trim())
      ? String(assigneeRaw).trim()
      : null
    const planned = typeof row[28] === 'number' ? row[28] : 0  // col28 = 계획
    const actual  = typeof row[29] === 'number' ? row[29] : 0  // col29 = 실적*

    tasks.push({
      wbs_code: String(wbsCode).trim(),
      wbs_level: wbsLevel as 1 | 2 | 3,
      task_name: String(taskName).trim(),
      start_date: startDate,
      end_date: endDate,
      planned_progress: planned,
      actual_progress: actual,
      assignee_name: assignee,
      status: computeStatus(actual, planned, endDate),
    })
  }

  return tasks
}

export function formatDate(dateString: string): string {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('ko-KR')
}

export function formatVersion(version: string): string {
  return version.startsWith('v') ? version : `v${version}`
}

type ClassValue = string | undefined | false | null | Record<string, boolean | undefined | null>

/** 클래스 이름 합치기. 객체를 넘기면 값이 참인 키만 포함합니다. */
export function cn(...classes: ClassValue[]): string {
  const out: string[] = []
  for (const c of classes) {
    if (!c) continue
    if (typeof c === 'string') out.push(c)
    else for (const [name, on] of Object.entries(c)) if (on) out.push(name)
  }
  return out.join(' ')
}

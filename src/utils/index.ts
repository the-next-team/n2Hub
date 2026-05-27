export function formatDate(dateString: string): string {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('ko-KR')
}

export function formatVersion(version: string): string {
  return version.startsWith('v') ? version : `v${version}`
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

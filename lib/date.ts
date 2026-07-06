export function formatYyyymmdd(date: Date): string {
  const yyyy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  return `${yyyy}${mm}${dd}`
}

export function todayUtc(): string {
  return formatYyyymmdd(new Date())
}

export function toDashDate(compact: string): string {
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`
}

export function toCompactDate(dash: string): string {
  return dash.replaceAll('-', '')
}

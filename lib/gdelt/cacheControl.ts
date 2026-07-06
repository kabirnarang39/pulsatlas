export function cacheControlFor(date: string, today: string): string {
  if (date === today) return 'public, max-age=60'
  return 'public, max-age=31536000, immutable'
}

import { themeCategory } from './themeCategory'
import type { GdeltEvent } from './types'

const COL = {
  GKGRECORDID: 0,
  DATE: 1,
  DocumentIdentifier: 4,
  V2Themes: 8,
  V2Locations: 10,
  V2Persons: 12,
  V2Organizations: 14,
  V2Tone: 15,
} as const

function firstListEntry(field: string): string | null {
  if (!field) return null
  const first = field.split(';')[0]
  if (!first) return null
  const name = first.split(',')[0].trim()
  return name || null
}

function firstThemeCode(themesField: string): string {
  if (!themesField) return 'none'
  const first = themesField.split(';')[0]
  if (!first) return 'none'
  return first.split(',')[0] || 'none'
}

export function parseGkgCsv(csv: string): GdeltEvent[] {
  const events: GdeltEvent[] = []
  for (const line of csv.split('\n')) {
    if (!line.trim()) continue
    const fields = line.split('\t')
    if (fields.length < 16) continue

    const locations = fields[COL.V2Locations].split(';').filter(Boolean)
    if (locations.length === 0) continue
    const locationParts = locations[0].split('#')
    if (locationParts.length < 7) continue

    const lat = Number(locationParts[5])
    const lon = Number(locationParts[6])
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) continue

    const date = fields[COL.DATE]
    const avgTone = Number(fields[COL.V2Tone].split(',')[0]) || 0

    events.push({
      id: fields[COL.GKGRECORDID],
      day: date.slice(0, 8),
      lat,
      lon,
      locationName: locationParts[1] || 'Unknown location',
      eventRootCode: firstThemeCode(fields[COL.V2Themes]),
      category: themeCategory(fields[COL.V2Themes]),
      actor1Name: firstListEntry(fields[COL.V2Persons]),
      actor2Name: firstListEntry(fields[COL.V2Organizations]),
      avgTone,
      sourceUrl: fields[COL.DocumentIdentifier],
      dateAdded: date,
    })
  }
  return events
}

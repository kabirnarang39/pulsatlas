import { categoryForRootCode } from './categoryMap'
import type { GdeltEvent } from './types'

const COL = {
  GlobalEventID: 0,
  Day: 1,
  Actor1Name: 6,
  Actor2Name: 16,
  AvgTone: 34,
  EventRootCode: 28,
  ActionGeo_FullName: 52,
  ActionGeo_Lat: 56,
  ActionGeo_Long: 57,
  DATEADDED: 59,
  SOURCEURL: 60,
} as const

export function parseEventsCsv(csv: string): GdeltEvent[] {
  const events: GdeltEvent[] = []
  for (const line of csv.split('\n')) {
    if (!line.trim()) continue
    const fields = line.split('\t')
    if (fields.length < 61) continue

    const lat = Number(fields[COL.ActionGeo_Lat])
    const lon = Number(fields[COL.ActionGeo_Long])
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) continue

    const eventRootCode = fields[COL.EventRootCode].trim()
    events.push({
      id: fields[COL.GlobalEventID],
      day: fields[COL.Day],
      lat,
      lon,
      locationName: fields[COL.ActionGeo_FullName] || 'Unknown location',
      eventRootCode,
      category: categoryForRootCode(eventRootCode),
      actor1Name: fields[COL.Actor1Name] || null,
      actor2Name: fields[COL.Actor2Name] || null,
      avgTone: Number(fields[COL.AvgTone]) || 0,
      sourceUrl: fields[COL.SOURCEURL],
      dateAdded: fields[COL.DATEADDED],
    })
  }
  return events
}

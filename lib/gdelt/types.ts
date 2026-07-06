export type EventCategory = 'conflict' | 'protest' | 'cooperation' | 'politics' | 'other'

export interface GdeltEvent {
  id: string
  day: string // YYYYMMDD
  lat: number
  lon: number
  locationName: string
  eventRootCode: string
  category: EventCategory
  actor1Name: string | null
  actor2Name: string | null
  avgTone: number
  sourceUrl: string
  dateAdded: string // YYYYMMDDHHMMSS
}

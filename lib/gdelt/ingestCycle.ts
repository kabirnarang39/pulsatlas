import JSZip from 'jszip'
import { parseEventsCsv } from './parseEvents'
import type { GdeltEvent } from './types'
import type { BlobStore } from '../storage/blobStore'

const LASTUPDATE_URL = 'http://data.gdeltproject.org/gdeltv2/lastupdate.txt'

export async function runIngestCycle(
  fetchFn: typeof fetch,
  blobStore: BlobStore
): Promise<{ ingested: number }> {
  const lastUpdateRes = await fetchFn(LASTUPDATE_URL)
  const lastUpdateText = await lastUpdateRes.text()
  const exportLine = lastUpdateText.split('\n').find((l) => l.includes('.export.CSV.zip'))
  if (!exportLine) return { ingested: 0 }

  const zipUrl = exportLine.trim().split(' ').pop()!
  const zipRes = await fetchFn(zipUrl)
  const zipBuffer = await zipRes.arrayBuffer()
  const zip = await JSZip.loadAsync(zipBuffer)
  const csvFile = Object.values(zip.files)[0]
  const csv = await csvFile.async('string')

  const events = parseEventsCsv(csv)
  const byDayCategory = new Map<string, GdeltEvent[]>()
  for (const event of events) {
    const key = `${event.day}|${event.category}`
    const group = byDayCategory.get(key) ?? []
    group.push(event)
    byDayCategory.set(key, group)
  }

  for (const [key, newEvents] of byDayCategory) {
    const [day, category] = key.split('|')
    const existing = await blobStore.getEvents(day, category)
    const existingIds = new Set(existing.map((e) => e.id))
    const merged = [...existing, ...newEvents.filter((e) => !existingIds.has(e.id))]
    await blobStore.putEvents(day, category, merged)
  }

  return { ingested: events.length }
}

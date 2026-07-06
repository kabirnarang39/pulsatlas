import JSZip from 'jszip'
import { parseEventsCsv } from './parseEvents'
import { parseGkgCsv } from './parseGkg'
import type { GdeltEvent } from './types'
import type { BlobStore } from '../storage/blobStore'

const LASTUPDATE_URL = 'http://data.gdeltproject.org/gdeltv2/lastupdate.txt'

async function fetchAndUnzipCsv(fetchFn: typeof fetch, zipUrl: string): Promise<string> {
  const zipRes = await fetchFn(zipUrl)
  const zipBuffer = await zipRes.arrayBuffer()
  const zip = await JSZip.loadAsync(zipBuffer)
  const csvFile = Object.values(zip.files)[0]
  return csvFile.async('string')
}

function findZipUrl(lastUpdateText: string, marker: string): string | null {
  const line = lastUpdateText.split('\n').find((l) => l.includes(marker))
  if (!line) return null
  return line.trim().split(' ').pop() ?? null
}

export async function runIngestCycle(
  fetchFn: typeof fetch,
  blobStore: BlobStore
): Promise<{ ingested: number }> {
  const lastUpdateRes = await fetchFn(LASTUPDATE_URL)
  const lastUpdateText = await lastUpdateRes.text()

  const exportUrl = findZipUrl(lastUpdateText, '.export.CSV.zip')
  if (!exportUrl) return { ingested: 0 }

  const csv = await fetchAndUnzipCsv(fetchFn, exportUrl)
  const events = parseEventsCsv(csv)

  let gkgEvents: GdeltEvent[] = []
  const gkgUrl = findZipUrl(lastUpdateText, '.gkg.csv.zip')
  if (gkgUrl) {
    try {
      const gkgCsv = await fetchAndUnzipCsv(fetchFn, gkgUrl)
      gkgEvents = parseGkgCsv(gkgCsv)
    } catch {
      // GKG fetch/parse failure must not block Events ingestion — retried next cycle
    }
  }

  const allEvents = [...events, ...gkgEvents]
  const byDayCategory = new Map<string, GdeltEvent[]>()
  for (const event of allEvents) {
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

  return { ingested: allEvents.length }
}

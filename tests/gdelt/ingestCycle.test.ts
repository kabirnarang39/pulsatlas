import { describe, it, expect, vi } from 'vitest'
import JSZip from 'jszip'
import { runIngestCycle } from '@/lib/gdelt/ingestCycle'
import { createMemoryBlobStore } from '@/lib/storage/memoryBlobStore'

function buildRow(overrides: Record<number, string>): string {
  const fields = new Array(61).fill('')
  for (const [i, v] of Object.entries(overrides)) fields[Number(i)] = v
  return fields.join('\t')
}

function buildGkgRow(overrides: Record<number, string>): string {
  const fields = new Array(16).fill('')
  for (const [i, v] of Object.entries(overrides)) fields[Number(i)] = v
  return fields.join('\t')
}

async function buildFixtureZip(filename: string, csv: string): Promise<ArrayBuffer> {
  const zip = new JSZip()
  zip.file(filename, csv)
  return zip.generateAsync({ type: 'arraybuffer' })
}

function mockFetch(exportZipBuffer: ArrayBuffer, gkgZipBuffer?: ArrayBuffer) {
  return vi.fn(async (url: string) => {
    if (url.includes('lastupdate.txt')) {
      return {
        text: async () =>
          '123 abc http://data.gdeltproject.org/gdeltv2/20260706123000.export.CSV.zip\n' +
          '456 def http://data.gdeltproject.org/gdeltv2/20260706123000.gkg.csv.zip\n',
      } as unknown as Response
    }
    if (url.includes('.gkg.csv.zip')) {
      if (!gkgZipBuffer) throw new Error('no gkg fixture provided')
      return { arrayBuffer: async () => gkgZipBuffer } as unknown as Response
    }
    return { arrayBuffer: async () => exportZipBuffer } as unknown as Response
  })
}

describe('runIngestCycle', () => {
  it('fetches, parses, and stores new events grouped by day and category', async () => {
    const row = buildRow({
      0: '1', 1: '20260706', 28: '19', 52: 'Paris, France',
      56: '48.8566', 57: '2.3522', 59: '20260706123000', 60: 'https://example.com/a',
    })
    const zipBuffer = await buildFixtureZip('20260706123000.export.CSV', row)
    const blobStore = createMemoryBlobStore()

    const result = await runIngestCycle(mockFetch(zipBuffer) as unknown as typeof fetch, blobStore)

    expect(result.ingested).toBe(1)
    const stored = await blobStore.getEvents('20260706', 'conflict')
    expect(stored).toHaveLength(1)
    expect(stored[0].sourceUrl).toBe('https://example.com/a')
  })

  it('dedupes events already stored from a previous cycle', async () => {
    const row = buildRow({
      0: '1', 1: '20260706', 28: '19', 56: '48.8566', 57: '2.3522',
      59: '20260706123000', 60: 'https://example.com/a',
    })
    const zipBuffer = await buildFixtureZip('20260706123000.export.CSV', row)
    const blobStore = createMemoryBlobStore()
    const fetchFn = mockFetch(zipBuffer) as unknown as typeof fetch

    await runIngestCycle(fetchFn, blobStore)
    const result = await runIngestCycle(fetchFn, blobStore)

    expect(result.ingested).toBe(1)
    const stored = await blobStore.getEvents('20260706', 'conflict')
    expect(stored).toHaveLength(1)
  })

  it('returns zero ingested when lastupdate.txt has no export line', async () => {
    const fetchFn = vi.fn(async () => ({ text: async () => '' }) as unknown as Response)
    const blobStore = createMemoryBlobStore()
    const result = await runIngestCycle(fetchFn as unknown as typeof fetch, blobStore)
    expect(result.ingested).toBe(0)
  })

  it('merges GKG-derived events alongside Events-derived ones in the same cycle', async () => {
    const eventRow = buildRow({
      0: '1', 1: '20260706', 28: '19', 56: '48.8566', 57: '2.3522',
      59: '20260706123000', 60: 'https://example.com/a',
    })
    const gkgRow = buildGkgRow({
      0: '20260706123000-9',
      1: '20260706123000',
      4: 'https://example.com/quake',
      8: 'NATURAL_DISASTER_EARTHQUAKE,10',
      10: '4#Tokyo, Japan#JA#JA13##35.6895#139.6917#-2345',
      15: '-3.5,2.1,5.6,-3.5,1.2,0.4,500',
    })
    const exportZip = await buildFixtureZip('20260706123000.export.CSV', eventRow)
    const gkgZip = await buildFixtureZip('20260706123000.gkg.csv', gkgRow)
    const blobStore = createMemoryBlobStore()

    const result = await runIngestCycle(mockFetch(exportZip, gkgZip) as unknown as typeof fetch, blobStore)

    expect(result.ingested).toBe(2)
    const conflictEvents = await blobStore.getEvents('20260706', 'conflict')
    expect(conflictEvents).toHaveLength(1)
    const disasterEvents = await blobStore.getEvents('20260706', 'disaster')
    expect(disasterEvents).toHaveLength(1)
    expect(disasterEvents[0].sourceUrl).toBe('https://example.com/quake')
  })

  it('still ingests Events data when the GKG fetch fails', async () => {
    const eventRow = buildRow({
      0: '1', 1: '20260706', 28: '19', 56: '48.8566', 57: '2.3522',
      59: '20260706123000', 60: 'https://example.com/a',
    })
    const exportZip = await buildFixtureZip('20260706123000.export.CSV', eventRow)
    const blobStore = createMemoryBlobStore()

    const result = await runIngestCycle(mockFetch(exportZip) as unknown as typeof fetch, blobStore)

    expect(result.ingested).toBe(1)
    const stored = await blobStore.getEvents('20260706', 'conflict')
    expect(stored).toHaveLength(1)
  })
})

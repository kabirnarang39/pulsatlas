import { describe, it, expect, vi } from 'vitest'
import JSZip from 'jszip'
import { runIngestCycle } from '@/lib/gdelt/ingestCycle'
import { createMemoryBlobStore } from '@/lib/storage/memoryBlobStore'

function buildRow(overrides: Record<number, string>): string {
  const fields = new Array(61).fill('')
  for (const [i, v] of Object.entries(overrides)) fields[Number(i)] = v
  return fields.join('\t')
}

async function buildFixtureZip(csv: string): Promise<ArrayBuffer> {
  const zip = new JSZip()
  zip.file('20260706123000.export.CSV', csv)
  return zip.generateAsync({ type: 'arraybuffer' })
}

function mockFetch(zipBuffer: ArrayBuffer) {
  return vi.fn(async (url: string) => {
    if (url.includes('lastupdate.txt')) {
      return {
        text: async () =>
          '123 abc http://data.gdeltproject.org/gdeltv2/20260706123000.export.CSV.zip\n',
      } as unknown as Response
    }
    return { arrayBuffer: async () => zipBuffer } as unknown as Response
  })
}

describe('runIngestCycle', () => {
  it('fetches, parses, and stores new events grouped by day and category', async () => {
    const row = buildRow({
      0: '1', 1: '20260706', 28: '19', 52: 'Paris, France',
      56: '48.8566', 57: '2.3522', 59: '20260706123000', 60: 'https://example.com/a',
    })
    const zipBuffer = await buildFixtureZip(row)
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
    const zipBuffer = await buildFixtureZip(row)
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
})

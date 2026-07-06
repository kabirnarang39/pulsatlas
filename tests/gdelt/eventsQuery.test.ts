import { describe, it, expect } from 'vitest'
import { queryEvents } from '@/lib/gdelt/eventsQuery'
import { createMemoryBlobStore } from '@/lib/storage/memoryBlobStore'
import type { GdeltEvent } from '@/lib/gdelt/types'

describe('queryEvents', () => {
  it('merges events across requested categories for a day', async () => {
    const store = createMemoryBlobStore()
    await store.putEvents('20260706', 'conflict', [{ id: '1' } as GdeltEvent])
    await store.putEvents('20260706', 'protest', [{ id: '2' } as GdeltEvent])
    await store.putEvents('20260706', 'politics', [{ id: '3' } as GdeltEvent])

    const events = await queryEvents(store, '20260706', ['conflict', 'protest'])
    expect(events.map((e) => e.id).sort()).toEqual(['1', '2'])
  })

  it('returns an empty array when no categories have data', async () => {
    const store = createMemoryBlobStore()
    expect(await queryEvents(store, '20260706', ['conflict'])).toEqual([])
  })
})

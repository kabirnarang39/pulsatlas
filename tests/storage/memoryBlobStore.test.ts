import { describe, it, expect } from 'vitest'
import { createMemoryBlobStore } from '@/lib/storage/memoryBlobStore'
import type { GdeltEvent } from '@/lib/gdelt/types'

describe('createMemoryBlobStore', () => {
  it('returns an empty array for a day/category with no events', async () => {
    const store = createMemoryBlobStore()
    expect(await store.getEvents('20260706', 'conflict')).toEqual([])
  })

  it('round-trips events for a day/category', async () => {
    const store = createMemoryBlobStore()
    const events = [{ id: '1' } as GdeltEvent]
    await store.putEvents('20260706', 'conflict', events)
    expect(await store.getEvents('20260706', 'conflict')).toEqual(events)
  })

  it('tracks finalized days independently of events', async () => {
    const store = createMemoryBlobStore()
    expect(await store.isFinalized('20260706')).toBe(false)
    await store.markFinalized('20260706')
    expect(await store.isFinalized('20260706')).toBe(true)
  })
})

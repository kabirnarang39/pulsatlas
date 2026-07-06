import { describe, it, expect } from 'vitest'
import { finalizeDay, yesterday } from '@/lib/gdelt/finalizeDay'
import { createMemoryBlobStore } from '@/lib/storage/memoryBlobStore'

describe('finalizeDay', () => {
  it('marks an unfinalized day as finalized', async () => {
    const store = createMemoryBlobStore()
    const result = await finalizeDay(store, '20260705')
    expect(result.finalized).toBe(true)
    expect(await store.isFinalized('20260705')).toBe(true)
  })

  it('is idempotent for an already-finalized day', async () => {
    const store = createMemoryBlobStore()
    await finalizeDay(store, '20260705')
    const result = await finalizeDay(store, '20260705')
    expect(result.finalized).toBe(false)
  })
})

describe('yesterday', () => {
  it('returns the UTC calendar day before the given date', () => {
    expect(yesterday(new Date('2026-07-06T10:00:00Z'))).toBe('20260705')
  })

  it('rolls over month boundaries', () => {
    expect(yesterday(new Date('2026-08-01T00:00:00Z'))).toBe('20260731')
  })
})

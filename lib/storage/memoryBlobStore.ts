import type { BlobStore } from './blobStore'
import type { GdeltEvent } from '../gdelt/types'

export function createMemoryBlobStore(): BlobStore {
  const events = new Map<string, GdeltEvent[]>()
  const finalized = new Set<string>()
  const key = (day: string, category: string) => `${day}/${category}`

  return {
    async getEvents(day, category) {
      return events.get(key(day, category)) ?? []
    },
    async putEvents(day, category, value) {
      events.set(key(day, category), value)
    },
    async isFinalized(day) {
      return finalized.has(day)
    },
    async markFinalized(day) {
      finalized.add(day)
    },
  }
}

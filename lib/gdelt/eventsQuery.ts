import type { BlobStore } from '../storage/blobStore'
import type { EventCategory, GdeltEvent } from './types'

export async function queryEvents(
  blobStore: BlobStore,
  date: string,
  categories: EventCategory[]
): Promise<GdeltEvent[]> {
  const results = await Promise.all(categories.map((category) => blobStore.getEvents(date, category)))
  return results.flat()
}

import type { BlobStore } from '../storage/blobStore'

export async function finalizeDay(blobStore: BlobStore, day: string): Promise<{ finalized: boolean }> {
  if (await blobStore.isFinalized(day)) return { finalized: false }
  await blobStore.markFinalized(day)
  return { finalized: true }
}

export function yesterday(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1))
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${yyyy}${mm}${dd}`
}

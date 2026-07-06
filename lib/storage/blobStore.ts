import { getStore } from '@netlify/blobs'
import type { GdeltEvent } from '../gdelt/types'

export interface BlobStore {
  getEvents(day: string, category: string): Promise<GdeltEvent[]>
  putEvents(day: string, category: string, events: GdeltEvent[]): Promise<void>
  isFinalized(day: string): Promise<boolean>
  markFinalized(day: string): Promise<void>
}

export class NetlifyBlobStore implements BlobStore {
  private store = getStore('pulsatlas-events')

  async getEvents(day: string, category: string): Promise<GdeltEvent[]> {
    const raw = await this.store.get(`${day}/${category}.json`)
    return raw ? JSON.parse(raw) : []
  }

  async putEvents(day: string, category: string, events: GdeltEvent[]): Promise<void> {
    await this.store.set(`${day}/${category}.json`, JSON.stringify(events))
  }

  async isFinalized(day: string): Promise<boolean> {
    const raw = await this.store.get(`${day}/.finalized`)
    return raw === 'true'
  }

  async markFinalized(day: string): Promise<void> {
    await this.store.set(`${day}/.finalized`, 'true')
  }
}

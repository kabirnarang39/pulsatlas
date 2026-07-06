import type { Config } from '@netlify/functions'
import { runIngestCycle } from '../../lib/gdelt/ingestCycle'
import { NetlifyBlobStore } from '../../lib/storage/blobStore'

export default async () => {
  const result = await runIngestCycle(fetch, new NetlifyBlobStore())
  return new Response(JSON.stringify(result), { status: 200 })
}

export const config: Config = {
  schedule: '*/15 * * * *',
}

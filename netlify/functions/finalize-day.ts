import type { Config } from '@netlify/functions'
import { finalizeDay, yesterday } from '../../lib/gdelt/finalizeDay'
import { NetlifyBlobStore } from '../../lib/storage/blobStore'

export default async () => {
  const day = yesterday(new Date())
  const result = await finalizeDay(new NetlifyBlobStore(), day)
  return new Response(JSON.stringify({ day, ...result }), { status: 200 })
}

export const config: Config = {
  schedule: '0 3 * * *',
}

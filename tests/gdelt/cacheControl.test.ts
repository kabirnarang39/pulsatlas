import { describe, it, expect } from 'vitest'
import { cacheControlFor } from '@/lib/gdelt/cacheControl'

describe('cacheControlFor', () => {
  it('uses a short cache for today (data may still be filling in)', () => {
    expect(cacheControlFor('20260706', '20260706')).toBe('public, max-age=60')
  })

  it('uses a long immutable cache for any date before today', () => {
    expect(cacheControlFor('20260705', '20260706')).toBe('public, max-age=31536000, immutable')
  })
})

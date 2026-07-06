import { describe, it, expect } from 'vitest'
import { formatYyyymmdd, toDashDate, toCompactDate } from '@/lib/date'

describe('date utilities', () => {
  it('formats a Date as compact YYYYMMDD in UTC', () => {
    expect(formatYyyymmdd(new Date('2026-07-06T23:00:00Z'))).toBe('20260706')
  })

  it('converts compact to dash format', () => {
    expect(toDashDate('20260706')).toBe('2026-07-06')
  })

  it('converts dash to compact format', () => {
    expect(toCompactDate('2026-07-06')).toBe('20260706')
  })
})

import { describe, it, expect } from 'vitest'
import { parseEventsCsv } from '@/lib/gdelt/parseEvents'

function buildRow(overrides: Record<number, string>): string {
  const fields = new Array(61).fill('')
  for (const [i, v] of Object.entries(overrides)) fields[Number(i)] = v
  return fields.join('\t')
}

describe('parseEventsCsv', () => {
  it('parses a valid row into a GdeltEvent', () => {
    const row = buildRow({
      0: '1234567',
      1: '20260706',
      6: 'UNITED STATES',
      16: 'CHINA',
      28: '19',
      52: 'Paris, France',
      56: '48.8566',
      57: '2.3522',
      59: '20260706123000',
      60: 'https://example.com/story',
    })
    const [event] = parseEventsCsv(row)
    expect(event).toEqual({
      id: '1234567',
      day: '20260706',
      lat: 48.8566,
      lon: 2.3522,
      locationName: 'Paris, France',
      eventRootCode: '19',
      category: 'conflict',
      actor1Name: 'UNITED STATES',
      actor2Name: 'CHINA',
      avgTone: 0,
      sourceUrl: 'https://example.com/story',
      dateAdded: '20260706123000',
    })
  })

  it('skips rows with missing or zero coordinates', () => {
    const row = buildRow({ 0: '1', 1: '20260706', 28: '01', 56: '0', 57: '0' })
    expect(parseEventsCsv(row)).toEqual([])
  })

  it('skips malformed rows with too few columns', () => {
    expect(parseEventsCsv('a\tb\tc')).toEqual([])
  })
})

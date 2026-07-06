import { describe, it, expect } from 'vitest'
import { parseGkgCsv } from '@/lib/gdelt/parseGkg'

function buildRow(overrides: Record<number, string>): string {
  const fields = new Array(16).fill('')
  for (const [i, v] of Object.entries(overrides)) fields[Number(i)] = v
  return fields.join('\t')
}

describe('parseGkgCsv', () => {
  it('parses a valid row into a GdeltEvent', () => {
    const row = buildRow({
      0: '20260707120000-123',
      1: '20260707120000',
      4: 'https://example.com/article',
      8: 'NATURAL_DISASTER_EARTHQUAKE,10;ECON_TRADE,50',
      10: '4#Tokyo, Japan#JA#JA13##35.6895#139.6917#-2345;3#Osaka#JA#JA27##34.6937#135.5023#-2346',
      12: 'John Smith,20;Jane Doe,60',
      14: 'World Health Organization,30',
      15: '-3.5,2.1,5.6,-3.5,1.2,0.4,500',
    })
    const [event] = parseGkgCsv(row)
    expect(event).toEqual({
      id: '20260707120000-123',
      day: '20260707',
      lat: 35.6895,
      lon: 139.6917,
      locationName: 'Tokyo, Japan',
      eventRootCode: 'NATURAL_DISASTER_EARTHQUAKE',
      category: 'disaster',
      actor1Name: 'John Smith',
      actor2Name: 'World Health Organization',
      avgTone: -3.5,
      sourceUrl: 'https://example.com/article',
      dateAdded: '20260707120000',
    })
  })

  it('skips rows with no parseable location', () => {
    const row = buildRow({ 0: '1', 1: '20260707120000' })
    expect(parseGkgCsv(row)).toEqual([])
  })

  it('skips malformed rows with too few columns', () => {
    expect(parseGkgCsv('a\tb\tc')).toEqual([])
  })
})

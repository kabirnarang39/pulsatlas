import { describe, it, expect } from 'vitest'
import { categoryForRootCode } from '@/lib/gdelt/categoryMap'

describe('categoryForRootCode', () => {
  it('maps root code 19 to conflict', () => {
    expect(categoryForRootCode('19')).toBe('conflict')
  })
  it('maps root code 14 to protest', () => {
    expect(categoryForRootCode('14')).toBe('protest')
  })
  it('maps root code 07 to cooperation', () => {
    expect(categoryForRootCode('07')).toBe('cooperation')
  })
  it('maps root code 01 to politics', () => {
    expect(categoryForRootCode('01')).toBe('politics')
  })
  it('maps an unrecognized code to other', () => {
    expect(categoryForRootCode('99')).toBe('other')
  })
})

describe('ALL_CATEGORIES and CATEGORY_LABELS', () => {
  it('includes the four GKG-only categories alongside the five CAMEO-derived ones', async () => {
    const { ALL_CATEGORIES, CATEGORY_LABELS } = await import('@/lib/gdelt/categoryMap')
    expect(ALL_CATEGORIES).toEqual([
      'conflict', 'protest', 'cooperation', 'politics',
      'disaster', 'economy', 'health', 'environment', 'other',
    ])
    expect(CATEGORY_LABELS.disaster).toBe('Disaster')
    expect(CATEGORY_LABELS.economy).toBe('Economy')
    expect(CATEGORY_LABELS.health).toBe('Health')
    expect(CATEGORY_LABELS.environment).toBe('Environment')
  })
})

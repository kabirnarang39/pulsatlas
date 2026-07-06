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

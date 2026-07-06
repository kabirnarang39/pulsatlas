import { describe, it, expect } from 'vitest'
import { toneColor } from '@/lib/gdelt/toneColor'

describe('toneColor', () => {
  it('returns the destructive red stop at the most negative end (-10)', () => {
    expect(toneColor(-10)).toBe('#ef4444')
  })

  it('returns the muted gray stop at neutral (0)', () => {
    expect(toneColor(0)).toBe('#94a3b8')
  })

  it('returns the cooperation green stop at the most positive end (10)', () => {
    expect(toneColor(10)).toBe('#22c55e')
  })

  it('clamps values beyond -10 to the same color as -10', () => {
    expect(toneColor(-50)).toBe(toneColor(-10))
  })

  it('clamps values beyond 10 to the same color as 10', () => {
    expect(toneColor(50)).toBe(toneColor(10))
  })

  it('interpolates a value between stops rather than snapping to one', () => {
    const midColor = toneColor(-5)
    expect(midColor).not.toBe(toneColor(-10))
    expect(midColor).not.toBe(toneColor(0))
  })
})

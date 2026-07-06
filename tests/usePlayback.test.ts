import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePlayback } from '@/lib/usePlayback'

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({}) } as Response)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('usePlayback', () => {
  it('prefetches the next day on start, then advances and prefetches on each tick', () => {
    const setDate = vi.fn()
    const { result } = renderHook(() =>
      usePlayback('2026-07-01', setDate, { min: '2026-07-01', max: '2026-07-10', categories: ['conflict'] })
    )

    act(() => result.current.toggle())
    expect(result.current.isPlaying).toBe(true)
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('date=20260702'))
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('categories=conflict'))

    act(() => vi.advanceTimersByTime(1000))
    expect(setDate).toHaveBeenCalledWith('2026-07-02')
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('date=20260703'))
  })

  it('stops playback when the next tick would exceed max, without calling setDate past it', () => {
    const setDate = vi.fn()
    const { result, rerender } = renderHook(
      ({ currentDate }) =>
        usePlayback(currentDate, setDate, { min: '2026-07-01', max: '2026-07-10', categories: ['conflict'] }),
      { initialProps: { currentDate: '2026-07-09' } }
    )

    act(() => result.current.toggle())
    act(() => vi.advanceTimersByTime(1000))
    expect(setDate).toHaveBeenCalledWith('2026-07-10')
    expect(result.current.isPlaying).toBe(true)

    rerender({ currentDate: '2026-07-10' })
    act(() => vi.advanceTimersByTime(1000))
    expect(setDate).toHaveBeenCalledTimes(1)
    expect(result.current.isPlaying).toBe(false)
  })

  it('toggle stops an in-progress playback', () => {
    const setDate = vi.fn()
    const { result } = renderHook(() =>
      usePlayback('2026-07-01', setDate, { min: '2026-07-01', max: '2026-07-10', categories: ['conflict'] })
    )

    act(() => result.current.toggle())
    expect(result.current.isPlaying).toBe(true)

    act(() => result.current.toggle())
    expect(result.current.isPlaying).toBe(false)

    act(() => vi.advanceTimersByTime(5000))
    expect(setDate).not.toHaveBeenCalled()
  })
})

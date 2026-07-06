import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useEvents } from '@/lib/useEvents'

beforeEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('useEvents', () => {
  it('loads events for the given date on mount', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ date: '20260706', events: [{ id: '1' }] }),
    } as Response)

    const { result } = renderHook(() => useEvents('20260706'))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.events).toEqual([{ id: '1' }])
  })

  it('sets error status when the request fails', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false } as Response)
    const { result } = renderHook(() => useEvents('20260706'))
    await waitFor(() => expect(result.current.status).toBe('error'))
  })

  it('persists category selection to localStorage and refetches', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ date: '20260706', events: [] }),
    } as Response)
    const { result } = renderHook(() => useEvents('20260706'))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.setCategories(['conflict']))
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('categories=conflict'))
    )
    expect(window.localStorage.getItem('pulsatlas:selectedCategories')).toBe(
      JSON.stringify(['conflict'])
    )
  })
})

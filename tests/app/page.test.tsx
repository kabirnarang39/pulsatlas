import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import HomePage from '@/app/page'
import * as useEventsModule from '@/lib/useEvents'
import * as usePlaybackModule from '@/lib/usePlayback'

vi.mock('@/components/Globe', () => ({ Globe: () => <div data-testid="globe" /> }))

function mockUseEvents(overrides: Partial<ReturnType<typeof useEventsModule.useEvents>> = {}) {
  vi.spyOn(useEventsModule, 'useEvents').mockReturnValue({
    events: [],
    categories: [],
    setCategories: vi.fn(),
    status: 'ready',
    retry: vi.fn(),
    ...overrides,
  })
}

describe('HomePage', () => {
  it('renders the globe when events load successfully', () => {
    mockUseEvents({ status: 'ready' })
    vi.spyOn(usePlaybackModule, 'usePlayback').mockReturnValue({ isPlaying: false, toggle: vi.fn() })
    render(<HomePage />)
    expect(screen.getByTestId('globe')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a retry alert when loading events fails, and retries on click', () => {
    const retry = vi.fn()
    mockUseEvents({ status: 'error', retry })
    vi.spyOn(usePlaybackModule, 'usePlayback').mockReturnValue({ isPlaying: false, toggle: vi.fn() })
    render(<HomePage />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    screen.getByText('Retry').click()
    expect(retry).toHaveBeenCalled()
  })

  it('stops playback when the date is changed manually while playing', () => {
    mockUseEvents({ status: 'ready' })
    const toggle = vi.fn()
    vi.spyOn(usePlaybackModule, 'usePlayback').mockReturnValue({ isPlaying: true, toggle })
    render(<HomePage />)
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-07-01' } })
    expect(toggle).toHaveBeenCalled()
  })
})

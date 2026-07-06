import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import HomePage from '@/app/page'
import * as useEventsModule from '@/lib/useEvents'

vi.mock('@/components/Globe', () => ({ Globe: () => <div data-testid="globe" /> }))

describe('HomePage', () => {
  it('renders the globe when events load successfully', () => {
    vi.spyOn(useEventsModule, 'useEvents').mockReturnValue({
      events: [],
      categories: [],
      setCategories: vi.fn(),
      status: 'ready',
      retry: vi.fn(),
    })
    render(<HomePage />)
    expect(screen.getByTestId('globe')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a retry alert when loading events fails, and retries on click', () => {
    const retry = vi.fn()
    vi.spyOn(useEventsModule, 'useEvents').mockReturnValue({
      events: [],
      categories: [],
      setCategories: vi.fn(),
      status: 'error',
      retry,
    })
    render(<HomePage />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    screen.getByText('Retry').click()
    expect(retry).toHaveBeenCalled()
  })
})

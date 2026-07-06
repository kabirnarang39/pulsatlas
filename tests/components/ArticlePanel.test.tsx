import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ArticlePanel } from '@/components/ArticlePanel'
import type { GdeltEvent } from '@/lib/gdelt/types'

const event = {
  id: '1',
  category: 'conflict',
  locationName: 'Paris, France',
  actor1Name: 'UNITED STATES',
  actor2Name: 'CHINA',
  sourceUrl: 'https://example.com/story',
  avgTone: -4.2,
} as GdeltEvent

describe('ArticlePanel', () => {
  it('renders nothing when no event is selected', () => {
    const { container } = render(<ArticlePanel event={null} onClose={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders event details and a link to the source', () => {
    render(<ArticlePanel event={event} onClose={() => {}} />)
    expect(screen.getByText('Conflict')).toBeInTheDocument()
    expect(screen.getByText('Paris, France')).toBeInTheDocument()
    expect(screen.getByText('UNITED STATES & CHINA')).toBeInTheDocument()
    expect(screen.getByText('Read full story →')).toHaveAttribute('href', 'https://example.com/story')
  })

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    render(<ArticlePanel event={event} onClose={onClose} />)
    screen.getByLabelText('Close').click()
    expect(onClose).toHaveBeenCalled()
  })

  it('keeps content visible during the closing transition, then removes it once the transition ends', () => {
    const { rerender, container } = render(<ArticlePanel event={event} onClose={() => {}} />)
    expect(screen.getByText('Paris, France')).toBeInTheDocument()

    rerender(<ArticlePanel event={null} onClose={() => {}} />)
    expect(screen.getByText('Paris, France')).toBeInTheDocument()

    fireEvent.transitionEnd(container.querySelector('aside')!)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a negative tone label for a strongly negative avgTone', () => {
    render(<ArticlePanel event={{ ...event, avgTone: -4.2 }} onClose={() => {}} />)
    expect(screen.getByText('Tone: -4.2 · Negative')).toBeInTheDocument()
  })

  it('shows a neutral tone label for an avgTone near zero', () => {
    render(<ArticlePanel event={{ ...event, avgTone: 0.3 }} onClose={() => {}} />)
    expect(screen.getByText('Tone: 0.3 · Neutral')).toBeInTheDocument()
  })

  it('shows a positive tone label for a strongly positive avgTone', () => {
    render(<ArticlePanel event={{ ...event, avgTone: 5.7 }} onClose={() => {}} />)
    expect(screen.getByText('Tone: 5.7 · Positive')).toBeInTheDocument()
  })
})

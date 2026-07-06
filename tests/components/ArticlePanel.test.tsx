import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ArticlePanel } from '@/components/ArticlePanel'
import type { GdeltEvent } from '@/lib/gdelt/types'

const event = {
  id: '1',
  category: 'conflict',
  locationName: 'Paris, France',
  actor1Name: 'UNITED STATES',
  actor2Name: 'CHINA',
  sourceUrl: 'https://example.com/story',
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
})

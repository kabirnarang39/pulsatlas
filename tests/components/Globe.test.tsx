import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Globe } from '@/components/Globe'
import type { GdeltEvent } from '@/lib/gdelt/types'

vi.mock('react-globe.gl', () => ({
  default: (props: { pointsData: GdeltEvent[]; onPointClick: (p: GdeltEvent) => void }) => (
    <div data-testid="globe-stub" data-point-count={props.pointsData.length}>
      <button onClick={() => props.onPointClick(props.pointsData[0])}>simulate-click</button>
    </div>
  ),
}))

const events = [
  { id: '1', lat: 1, lon: 1, category: 'conflict' } as GdeltEvent,
  { id: '2', lat: 2, lon: 2, category: 'protest' } as GdeltEvent,
]

describe('Globe', () => {
  it('passes all events to the underlying globe as points', async () => {
    render(<Globe events={events} onSelectEvent={() => {}} />)
    expect(await screen.findByTestId('globe-stub')).toHaveAttribute('data-point-count', '2')
  })

  it('calls onSelectEvent when a point is clicked', async () => {
    const onSelectEvent = vi.fn()
    render(<Globe events={events} onSelectEvent={onSelectEvent} />)
    ;(await screen.findByText('simulate-click')).click()
    expect(onSelectEvent).toHaveBeenCalledWith(events[0])
  })
})

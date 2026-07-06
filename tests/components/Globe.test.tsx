import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Globe } from '@/components/Globe'
import { toneColor } from '@/lib/gdelt/toneColor'
import type { GdeltEvent } from '@/lib/gdelt/types'

vi.mock('react-globe.gl', () => ({
  default: (props: {
    pointsData: GdeltEvent[]
    pointColor: (e: object) => string
    onPointClick: (p: GdeltEvent) => void
  }) => (
    <div data-testid="globe-stub" data-point-count={props.pointsData.length}>
      {props.pointsData.map((point) => (
        <span key={point.id} data-testid={`point-color-${point.id}`}>
          {props.pointColor(point)}
        </span>
      ))}
      <button onClick={() => props.onPointClick(props.pointsData[0])}>simulate-click</button>
    </div>
  ),
}))

const events = [
  { id: '1', lat: 1, lon: 1, category: 'conflict', avgTone: -8 } as GdeltEvent,
  { id: '2', lat: 2, lon: 2, category: 'protest', avgTone: 3 } as GdeltEvent,
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

  it('colors points by category when colorMode is omitted (defaults to category)', async () => {
    render(<Globe events={events} onSelectEvent={() => {}} />)
    expect(await screen.findByTestId('point-color-1')).toHaveTextContent('#EF4444')
    expect(await screen.findByTestId('point-color-2')).toHaveTextContent('#F59E0B')
  })

  it('colors points by tone when colorMode is "tone"', async () => {
    render(<Globe events={events} onSelectEvent={() => {}} colorMode="tone" />)
    expect(await screen.findByTestId('point-color-1')).toHaveTextContent(toneColor(-8))
    expect(await screen.findByTestId('point-color-2')).toHaveTextContent(toneColor(3))
  })
})

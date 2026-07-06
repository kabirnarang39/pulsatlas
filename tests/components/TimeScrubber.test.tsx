import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TimeScrubber } from '@/components/TimeScrubber'

describe('TimeScrubber', () => {
  it('renders the current value in a date input', () => {
    render(<TimeScrubber value="2026-07-06" min="2026-01-01" max="2026-07-06" onChange={() => {}} />)
    expect(screen.getByLabelText('Date')).toHaveValue('2026-07-06')
  })

  it('calls onChange with the newly picked date', () => {
    const onChange = vi.fn()
    render(<TimeScrubber value="2026-07-06" min="2026-01-01" max="2026-07-06" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-07-01' } })
    expect(onChange).toHaveBeenCalledWith('2026-07-01')
  })
})

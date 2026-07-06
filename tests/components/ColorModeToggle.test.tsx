import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ColorModeToggle } from '@/components/ColorModeToggle'

describe('ColorModeToggle', () => {
  it('renders both pills', () => {
    render(<ColorModeToggle mode="category" onChange={() => {}} />)
    expect(screen.getByText('Category')).toBeInTheDocument()
    expect(screen.getByText('Tone')).toBeInTheDocument()
  })

  it('marks the active mode as pressed', () => {
    render(<ColorModeToggle mode="tone" onChange={() => {}} />)
    expect(screen.getByText('Tone')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Category')).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onChange with the other mode when clicked', () => {
    const onChange = vi.fn()
    render(<ColorModeToggle mode="category" onChange={onChange} />)
    screen.getByText('Tone').click()
    expect(onChange).toHaveBeenCalledWith('tone')
  })
})

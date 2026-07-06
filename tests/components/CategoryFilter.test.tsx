import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CategoryFilter } from '@/components/CategoryFilter'
import { ALL_CATEGORIES } from '@/lib/gdelt/categoryMap'

describe('CategoryFilter', () => {
  it('renders a button for every category', () => {
    render(<CategoryFilter selected={ALL_CATEGORIES} onChange={() => {}} />)
    expect(screen.getAllByRole('button')).toHaveLength(ALL_CATEGORIES.length)
  })

  it('marks selected categories as pressed', () => {
    render(<CategoryFilter selected={['conflict']} onChange={() => {}} />)
    expect(screen.getByText('Conflict')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Protest')).toHaveAttribute('aria-pressed', 'false')
  })

  it('removes an active category when clicked', () => {
    const onChange = vi.fn()
    render(<CategoryFilter selected={['conflict', 'protest']} onChange={onChange} />)
    screen.getByText('Conflict').click()
    expect(onChange).toHaveBeenCalledWith(['protest'])
  })

  it('adds an inactive category when clicked', () => {
    const onChange = vi.fn()
    render(<CategoryFilter selected={['conflict']} onChange={onChange} />)
    screen.getByText('Protest').click()
    expect(onChange).toHaveBeenCalledWith(['conflict', 'protest'])
  })
})

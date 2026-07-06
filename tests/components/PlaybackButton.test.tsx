import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PlaybackButton } from '@/components/PlaybackButton'

describe('PlaybackButton', () => {
  it('shows a play icon and label when not playing', () => {
    render(<PlaybackButton isPlaying={false} onToggle={() => {}} />)
    const button = screen.getByRole('button', { name: 'Play time-lapse' })
    expect(button).toHaveTextContent('▶')
    expect(button).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows a pause icon and label when playing', () => {
    render(<PlaybackButton isPlaying={true} onToggle={() => {}} />)
    const button = screen.getByRole('button', { name: 'Pause playback' })
    expect(button).toHaveTextContent('⏸')
    expect(button).toHaveAttribute('aria-pressed', 'true')
  })

  it('calls onToggle when clicked', () => {
    const onToggle = vi.fn()
    render(<PlaybackButton isPlaying={false} onToggle={onToggle} />)
    screen.getByRole('button').click()
    expect(onToggle).toHaveBeenCalled()
  })
})

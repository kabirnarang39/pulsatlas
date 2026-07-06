'use client'
interface PlaybackButtonProps {
  isPlaying: boolean
  onToggle: () => void
}

export function PlaybackButton({ isPlaying, onToggle }: PlaybackButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isPlaying ? 'Pause playback' : 'Play time-lapse'}
      aria-pressed={isPlaying}
      className="rounded-md border border-white/10 bg-card px-2 py-1.5 text-sm text-foreground transition duration-150 ease hover:border-accent active:scale-[0.97]"
    >
      {isPlaying ? '⏸' : '▶'}
    </button>
  )
}

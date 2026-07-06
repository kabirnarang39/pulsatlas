'use client'
interface TimeScrubberProps {
  value: string
  min: string
  max: string
  onChange: (next: string) => void
}

export function TimeScrubber({ value, min, max, onChange }: TimeScrubberProps) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      <span>Date</span>
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-white/10 bg-card px-2 py-1.5 text-sm text-foreground [color-scheme:dark] focus:border-accent focus:outline-none"
      />
    </label>
  )
}

'use client'
interface TimeScrubberProps {
  value: string
  min: string
  max: string
  onChange: (next: string) => void
}

export function TimeScrubber({ value, min, max, onChange }: TimeScrubberProps) {
  return (
    <label>
      <span>Date</span>
      <input type="date" value={value} min={min} max={max} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

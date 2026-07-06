'use client'
export type ColorMode = 'category' | 'tone'

interface ColorModeToggleProps {
  mode: ColorMode
  onChange: (next: ColorMode) => void
}

const OPTIONS: { mode: ColorMode; label: string }[] = [
  { mode: 'category', label: 'Category' },
  { mode: 'tone', label: 'Tone' },
]

export function ColorModeToggle({ mode, onChange }: ColorModeToggleProps) {
  return (
    <div role="group" aria-label="Color mode" className="flex items-center gap-2">
      {OPTIONS.map((option) => {
        const isActive = option.mode === mode
        return (
          <button
            key={option.mode}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(option.mode)}
            className={
              isActive
                ? 'rounded-full border border-accent bg-accent/20 px-3 py-1.5 text-sm font-medium text-foreground transition duration-150 ease active:scale-[0.97]'
                : 'rounded-full border border-white/10 bg-card px-3 py-1.5 text-sm font-medium text-muted transition duration-150 ease hover:border-white/25 hover:text-foreground active:scale-[0.97]'
            }
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

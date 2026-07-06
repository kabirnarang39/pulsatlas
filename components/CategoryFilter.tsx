'use client'
import { ALL_CATEGORIES, CATEGORY_LABELS } from '@/lib/gdelt/categoryMap'
import type { EventCategory } from '@/lib/gdelt/types'

interface CategoryFilterProps {
  selected: EventCategory[]
  onChange: (next: EventCategory[]) => void
}

export function CategoryFilter({ selected, onChange }: CategoryFilterProps) {
  function toggle(category: EventCategory) {
    if (selected.includes(category)) {
      onChange(selected.filter((c) => c !== category))
    } else {
      onChange([...selected, category])
    }
  }

  return (
    <div role="group" aria-label="Category filter" className="flex flex-wrap items-center gap-2">
      {ALL_CATEGORIES.map((category) => {
        const isSelected = selected.includes(category)
        return (
          <button
            key={category}
            type="button"
            aria-pressed={isSelected}
            onClick={() => toggle(category)}
            className={
              isSelected
                ? 'rounded-full border border-accent bg-accent/20 px-3 py-1.5 text-sm font-medium text-foreground transition duration-150 ease active:scale-[0.97]'
                : 'rounded-full border border-white/10 bg-card px-3 py-1.5 text-sm font-medium text-muted transition duration-150 ease hover:border-white/25 hover:text-foreground active:scale-[0.97]'
            }
          >
            {CATEGORY_LABELS[category]}
          </button>
        )
      })}
    </div>
  )
}

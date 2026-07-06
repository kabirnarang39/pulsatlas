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
    <div role="group" aria-label="Category filter">
      {ALL_CATEGORIES.map((category) => (
        <button
          key={category}
          type="button"
          aria-pressed={selected.includes(category)}
          onClick={() => toggle(category)}
        >
          {CATEGORY_LABELS[category]}
        </button>
      ))}
    </div>
  )
}

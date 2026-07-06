'use client'
import type { GdeltEvent } from '@/lib/gdelt/types'
import { CATEGORY_LABELS } from '@/lib/gdelt/categoryMap'

interface ArticlePanelProps {
  event: GdeltEvent | null
  onClose: () => void
}

export function ArticlePanel({ event, onClose }: ArticlePanelProps) {
  if (!event) return null

  const actors = [event.actor1Name, event.actor2Name].filter(Boolean).join(' & ')

  return (
    <aside role="complementary" aria-label="Event details">
      <button type="button" onClick={onClose} aria-label="Close">
        ×
      </button>
      <p>{CATEGORY_LABELS[event.category]}</p>
      <p>{event.locationName}</p>
      {actors && <p>{actors}</p>}
      <a href={event.sourceUrl} target="_blank" rel="noreferrer noopener">
        Read full story →
      </a>
    </aside>
  )
}

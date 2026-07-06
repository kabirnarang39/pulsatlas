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
    <aside
      role="complementary"
      aria-label="Event details"
      className="fixed right-4 top-24 z-20 w-[min(90vw,22rem)] rounded-xl border border-white/10 bg-card/90 p-4 shadow-xl backdrop-blur-md sm:right-6"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-3 top-3 text-lg leading-none text-muted transition hover:text-foreground"
      >
        ×
      </button>
      <p className="pr-6 font-heading text-sm font-semibold uppercase tracking-wide text-accent">
        {CATEGORY_LABELS[event.category]}
      </p>
      <p className="mt-2 text-base font-medium">{event.locationName}</p>
      {actors && <p className="mt-1 text-sm text-muted">{actors}</p>}
      <a
        href={event.sourceUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-3 inline-block text-sm font-medium text-accent hover:underline"
      >
        Read full story →
      </a>
    </aside>
  )
}

'use client'
import { useEffect, useState } from 'react'
import type { GdeltEvent } from '@/lib/gdelt/types'
import { CATEGORY_LABELS } from '@/lib/gdelt/categoryMap'

interface ArticlePanelProps {
  event: GdeltEvent | null
  onClose: () => void
}

function toneLabel(avgTone: number): string {
  if (avgTone < -1) return 'Negative'
  if (avgTone > 1) return 'Positive'
  return 'Neutral'
}

export function ArticlePanel({ event, onClose }: ArticlePanelProps) {
  const [renderedEvent, setRenderedEvent] = useState<GdeltEvent | null>(event)
  const [isOpen, setIsOpen] = useState(Boolean(event))

  useEffect(() => {
    if (event) {
      setRenderedEvent(event)
      const id = requestAnimationFrame(() => setIsOpen(true))
      return () => cancelAnimationFrame(id)
    }
    setIsOpen(false)
  }, [event])

  if (!renderedEvent) return null

  const actors = [renderedEvent.actor1Name, renderedEvent.actor2Name].filter(Boolean).join(' & ')

  return (
    <aside
      role="complementary"
      aria-label="Event details"
      onTransitionEnd={(e) => {
        if (e.target === e.currentTarget && !isOpen) setRenderedEvent(null)
      }}
      className={`fixed right-4 top-24 z-20 w-[min(90vw,22rem)] rounded-xl border border-white/10 bg-card/90 p-4 shadow-xl backdrop-blur-md transition-[opacity,transform] ease-out sm:right-6 ${
        isOpen ? 'duration-200 translate-y-0 opacity-100' : 'pointer-events-none duration-[160ms] -translate-y-1 opacity-0'
      }`}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-3 top-3 text-lg leading-none text-muted transition duration-150 ease hover:text-foreground active:scale-[0.97]"
      >
        ×
      </button>
      <p className="pr-6 font-heading text-sm font-semibold uppercase tracking-wide text-accent">
        {CATEGORY_LABELS[renderedEvent.category]}
      </p>
      <p className="mt-2 text-base font-medium">{renderedEvent.locationName}</p>
      {actors && <p className="mt-1 text-sm text-muted">{actors}</p>}
      <p className="mt-1 text-sm text-muted">
        Tone: {renderedEvent.avgTone.toFixed(1)} · {toneLabel(renderedEvent.avgTone)}
      </p>
      <a
        href={renderedEvent.sourceUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-3 inline-block text-sm font-medium text-accent transition-colors duration-150 ease hover:underline"
      >
        Read full story →
      </a>
    </aside>
  )
}

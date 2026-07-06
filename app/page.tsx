'use client'
import { useState } from 'react'
import { Globe } from '@/components/Globe'
import { CategoryFilter } from '@/components/CategoryFilter'
import { ColorModeToggle, type ColorMode } from '@/components/ColorModeToggle'
import { TimeScrubber } from '@/components/TimeScrubber'
import { PlaybackButton } from '@/components/PlaybackButton'
import { ArticlePanel } from '@/components/ArticlePanel'
import { AdSlot } from '@/components/AdSlot'
import { SupportLink } from '@/components/SupportLink'
import { useEvents } from '@/lib/useEvents'
import { usePlayback } from '@/lib/usePlayback'
import { todayUtc, toDashDate, toCompactDate } from '@/lib/date'
import type { GdeltEvent } from '@/lib/gdelt/types'

const EARLIEST_DATE = '2026-07-01'

export default function HomePage() {
  const [dashDate, setDashDate] = useState(toDashDate(todayUtc()))
  const { events, categories, setCategories, status, retry } = useEvents(toCompactDate(dashDate))
  const [selectedEvent, setSelectedEvent] = useState<GdeltEvent | null>(null)
  const [colorMode, setColorMode] = useState<ColorMode>('category')
  const { isPlaying, toggle } = usePlayback(dashDate, setDashDate, {
    min: EARLIEST_DATE,
    max: toDashDate(todayUtc()),
    categories,
  })

  function handleDateChange(next: string) {
    if (isPlaying) toggle()
    setDashDate(next)
  }

  return (
    <main className="relative bg-background font-body text-foreground">
      <div className="fixed inset-0 z-0">
        <Globe events={events} onSelectEvent={setSelectedEvent} colorMode={colorMode} />
      </div>

      <div className="pointer-events-none fixed inset-0 z-10 flex flex-col">
        <header className="pointer-events-auto flex flex-wrap items-center justify-between gap-3 border-b border-white/5 bg-card/70 px-4 py-3 backdrop-blur-md sm:px-6">
          <h1 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">Pulsatlas</h1>
          <SupportLink />
        </header>

        <div className="pointer-events-auto flex flex-wrap items-center gap-3 border-b border-white/5 bg-card/40 px-4 py-3 backdrop-blur-md sm:px-6">
          <CategoryFilter selected={categories} onChange={setCategories} />
          <ColorModeToggle mode={colorMode} onChange={setColorMode} />
          <TimeScrubber value={dashDate} min={EARLIEST_DATE} max={toDashDate(todayUtc())} onChange={handleDateChange} />
          <PlaybackButton isPlaying={isPlaying} onToggle={toggle} />
        </div>

        {status === 'error' && (
          <div
            role="alert"
            className="pointer-events-auto flex animate-[banner-in_200ms_ease-out] items-center gap-3 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive backdrop-blur-md sm:px-6"
          >
            Couldn&apos;t load this day&apos;s events.
            <button
              type="button"
              onClick={retry}
              className="rounded-md border border-destructive/40 px-2 py-1 font-medium transition duration-150 ease hover:bg-destructive/20 active:scale-[0.97]"
            >
              Retry
            </button>
          </div>
        )}

        <div className="flex-1" />

        <div
          className="pointer-events-auto flex justify-center overflow-hidden border-t border-white/5 bg-card/40 px-4 py-3 backdrop-blur-md sm:px-6"
          style={{ maxHeight: '6rem' }}
        >
          {/* AdSense's script forcibly overrides height/max-height with !important on
              whatever element directly wraps the <ins> tag. This inner div absorbs that —
              the outer bar's own maxHeight (untouched by Google's script) still clips it. */}
          <div className="w-full max-w-3xl overflow-hidden">
            <AdSlot slotId="1111111111" />
          </div>
        </div>
      </div>

      <ArticlePanel event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </main>
  )
}

'use client'
import { useState } from 'react'
import { Globe } from '@/components/Globe'
import { CategoryFilter } from '@/components/CategoryFilter'
import { TimeScrubber } from '@/components/TimeScrubber'
import { ArticlePanel } from '@/components/ArticlePanel'
import { AdSlot } from '@/components/AdSlot'
import { SupportLink } from '@/components/SupportLink'
import { useEvents } from '@/lib/useEvents'
import { todayUtc, toDashDate, toCompactDate } from '@/lib/date'
import type { GdeltEvent } from '@/lib/gdelt/types'

const EARLIEST_DATE = '2026-07-01'

export default function HomePage() {
  const [dashDate, setDashDate] = useState(toDashDate(todayUtc()))
  const { events, categories, setCategories, status, retry } = useEvents(toCompactDate(dashDate))
  const [selectedEvent, setSelectedEvent] = useState<GdeltEvent | null>(null)

  return (
    <main>
      <header>
        <h1>Pulsatlas</h1>
        <SupportLink />
      </header>

      <CategoryFilter selected={categories} onChange={setCategories} />
      <TimeScrubber value={dashDate} min={EARLIEST_DATE} max={toDashDate(todayUtc())} onChange={setDashDate} />

      {status === 'error' && (
        <div role="alert">
          Couldn&apos;t load this day&apos;s events.{' '}
          <button type="button" onClick={retry}>
            Retry
          </button>
        </div>
      )}

      <Globe events={events} onSelectEvent={setSelectedEvent} />
      <ArticlePanel event={selectedEvent} onClose={() => setSelectedEvent(null)} />

      <AdSlot slotId="1111111111" />
    </main>
  )
}

'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toCompactDate } from './date'
import type { EventCategory } from './gdelt/types'

const TICK_MS = 1000

function addOneDay(dash: string): string {
  const [y, m, d] = dash.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + 1))
  const yyyy = next.getUTCFullYear()
  const mm = String(next.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(next.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

interface UsePlaybackOptions {
  min: string
  max: string
  categories: EventCategory[]
}

export function usePlayback(currentDate: string, setDate: (next: string) => void, options: UsePlaybackOptions) {
  const [isPlaying, setIsPlaying] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stateRef = useRef({ currentDate, ...options })
  stateRef.current = { currentDate, ...options }

  const prefetch = useCallback((dashDate: string) => {
    const date = toCompactDate(dashDate)
    const categories = stateRef.current.categories.join(',')
    fetch(`/api/events?date=${date}&categories=${categories}`).catch(() => {})
  }, [])

  const stop = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setIsPlaying(false)
  }, [])

  const tick = useCallback(() => {
    const { currentDate: current, max } = stateRef.current
    const next = addOneDay(current)
    if (next > max) {
      stop()
      return
    }
    setDate(next)
    prefetch(addOneDay(next))
  }, [setDate, prefetch, stop])

  const start = useCallback(() => {
    prefetch(addOneDay(stateRef.current.currentDate))
    intervalRef.current = setInterval(tick, TICK_MS)
    setIsPlaying(true)
  }, [prefetch, tick])

  const toggle = useCallback(() => {
    if (isPlaying) {
      stop()
    } else {
      start()
    }
  }, [isPlaying, start, stop])

  useEffect(() => stop, [stop])

  return { isPlaying, toggle }
}

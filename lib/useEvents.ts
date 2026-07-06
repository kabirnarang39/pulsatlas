'use client'
import { useCallback, useEffect, useState } from 'react'
import type { EventCategory, GdeltEvent } from './gdelt/types'
import { ALL_CATEGORIES } from './gdelt/categoryMap'

const STORAGE_KEY = 'pulsatlas:selectedCategories'

function loadStoredCategories(): EventCategory[] {
  if (typeof window === 'undefined') return ALL_CATEGORIES
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return ALL_CATEGORIES
  try {
    return JSON.parse(raw)
  } catch {
    return ALL_CATEGORIES
  }
}

export function useEvents(date: string) {
  const [categories, setCategoriesState] = useState<EventCategory[]>(loadStoredCategories)
  const [events, setEvents] = useState<GdeltEvent[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle')

  const setCategories = useCallback((next: EventCategory[]) => {
    setCategoriesState(next)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }, [])

  const load = useCallback(async () => {
    setStatus('loading')
    try {
      const res = await fetch(`/api/events?date=${date}&categories=${categories.join(',')}`)
      if (!res.ok) throw new Error('request failed')
      const data = await res.json()
      setEvents(data.events)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [date, categories])

  useEffect(() => {
    load()
  }, [load])

  return { events, categories, setCategories, status, retry: load }
}

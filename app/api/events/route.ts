import { NextRequest, NextResponse } from 'next/server'
import { NetlifyBlobStore } from '@/lib/storage/blobStore'
import { ALL_CATEGORIES } from '@/lib/gdelt/categoryMap'
import { queryEvents } from '@/lib/gdelt/eventsQuery'
import type { EventCategory } from '@/lib/gdelt/types'

export async function GET(request: NextRequest) {
  const blobStore = new NetlifyBlobStore()
  const date = request.nextUrl.searchParams.get('date')
  const categoriesParam = request.nextUrl.searchParams.get('categories')

  if (!date || !/^\d{8}$/.test(date)) {
    return NextResponse.json({ error: 'date must be provided as YYYYMMDD' }, { status: 400 })
  }

  const validCategories = new Set<string>(ALL_CATEGORIES)
  const categories = categoriesParam
    ? (categoriesParam
        .split(',')
        .map((c) => c.trim())
        .filter((c) => validCategories.has(c)) as EventCategory[])
    : ALL_CATEGORIES
  const events = await queryEvents(blobStore, date, categories)

  return NextResponse.json({ date, events })
}

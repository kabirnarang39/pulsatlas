import type { EventCategory } from './types'

const CONFLICT_CODES = new Set(['18', '19', '20'])
const PROTEST_CODES = new Set(['14'])
const COOPERATION_CODES = new Set(['06', '07', '08'])
const POLITICS_CODES = new Set([
  '01', '02', '03', '04', '05', '09', '10', '11', '12', '13', '15', '16', '17',
])

export function categoryForRootCode(rootCode: string): EventCategory {
  const code = rootCode.padStart(2, '0')
  if (CONFLICT_CODES.has(code)) return 'conflict'
  if (PROTEST_CODES.has(code)) return 'protest'
  if (COOPERATION_CODES.has(code)) return 'cooperation'
  if (POLITICS_CODES.has(code)) return 'politics'
  return 'other'
}

export const ALL_CATEGORIES: EventCategory[] = ['conflict', 'protest', 'cooperation', 'politics', 'other']

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  conflict: 'Conflict',
  protest: 'Protest',
  cooperation: 'Cooperation & Aid',
  politics: 'Politics & Diplomacy',
  other: 'Other',
}

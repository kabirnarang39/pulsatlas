import type { EventCategory } from './types'

function extractThemeCodes(themesField: string): string[] {
  return themesField
    .split(';')
    .filter(Boolean)
    .map((entry) => entry.split(',')[0])
}

export function themeCategory(themesField: string): EventCategory {
  const codes = extractThemeCodes(themesField)
  if (codes.some((c) => c.includes('NATURAL_DISASTER') || c.startsWith('CRISISLEX'))) return 'disaster'
  if (codes.some((c) => c.includes('HEALTH') || c.includes('DISEASE') || c.includes('PANDEMIC'))) return 'health'
  if (codes.some((c) => c.startsWith('ECON_'))) return 'economy'
  if (codes.some((c) => c.startsWith('ENV_'))) return 'environment'
  return 'other'
}

import { describe, it, expect } from 'vitest'
import { themeCategory } from '@/lib/gdelt/themeCategory'

describe('themeCategory', () => {
  it('maps a NATURAL_DISASTER theme to disaster', () => {
    expect(themeCategory('NATURAL_DISASTER_EARTHQUAKE,10')).toBe('disaster')
  })

  it('maps a CRISISLEX-prefixed theme to disaster', () => {
    expect(themeCategory('CRISISLEX_T03_DEAD,5')).toBe('disaster')
  })

  it('maps a theme containing HEALTH to health', () => {
    expect(themeCategory('TAX_HEALTH_MENTAL_HEALTH,20')).toBe('health')
  })

  it('maps a theme containing PANDEMIC to health', () => {
    expect(themeCategory('EPU_CATS_PANDEMIC,15')).toBe('health')
  })

  it('maps an ECON_-prefixed theme to economy', () => {
    expect(themeCategory('ECON_TRADE,30')).toBe('economy')
  })

  it('maps an ENV_-prefixed theme to environment', () => {
    expect(themeCategory('ENV_CLIMATECHANGE,40')).toBe('environment')
  })

  it('falls back to other for an unrecognized theme list', () => {
    expect(themeCategory('TAX_FNCACT_POLITICIAN,5')).toBe('other')
  })

  it('falls back to other for an empty theme field', () => {
    expect(themeCategory('')).toBe('other')
  })

  it('prioritizes disaster over economy when both themes are present', () => {
    expect(themeCategory('ECON_TRADE,10;NATURAL_DISASTER_FLOOD,20')).toBe('disaster')
  })
})

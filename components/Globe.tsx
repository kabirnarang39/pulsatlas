'use client'
import dynamic from 'next/dynamic'
import type { GdeltEvent } from '@/lib/gdelt/types'

const ReactGlobe = dynamic(() => import('react-globe.gl'), { ssr: false })

const CATEGORY_COLORS: Record<GdeltEvent['category'], string> = {
  conflict: '#EF4444',
  protest: '#F59E0B',
  cooperation: '#22C55E',
  politics: '#3B82F6',
  other: '#94A3B8',
}

interface GlobeProps {
  events: GdeltEvent[]
  onSelectEvent: (event: GdeltEvent) => void
}

export function Globe({ events, onSelectEvent }: GlobeProps) {
  return (
    <ReactGlobe
      backgroundColor="#0B0B10"
      globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
      pointsData={events}
      pointLat="lat"
      pointLng="lon"
      pointColor={(e: object) => CATEGORY_COLORS[(e as GdeltEvent).category]}
      pointRadius={0.4}
      onPointClick={(point: object) => onSelectEvent(point as GdeltEvent)}
    />
  )
}

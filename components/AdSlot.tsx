'use client'
import { useEffect } from 'react'

interface AdSlotProps {
  slotId: string
}

declare global {
  interface Window {
    adsbygoogle?: { push: (params: object) => void } | unknown[]
  }
}

export function AdSlot({ slotId }: AdSlotProps) {
  useEffect(() => {
    try {
      const queue = (window.adsbygoogle = window.adsbygoogle || [])
      ;(queue as { push: (params: object) => void }).push({})
    } catch {
      // AdSense script blocked or unavailable — the ad slot simply stays empty
    }
  }, [])

  return (
    <ins
      className="adsbygoogle w-full max-w-3xl"
      style={{ display: 'block', minHeight: '90px' }}
      data-ad-client="ca-pub-REPLACE_WITH_PUBLISHER_ID"
      data-ad-slot={slotId}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  )
}

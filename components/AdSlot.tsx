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
    // Fixed-size unit (not `data-ad-format="auto"` + `data-full-width-responsive`):
    // that responsive combo makes AdSense's script forcibly clear height/max-height
    // (with !important) on every ancestor up the tree to let the ad "auto-relax" into
    // available space — it was ballooning this footer slot to 300+px and blocking
    // globe interaction underneath. A fixed-size unit doesn't do that.
    <ins
      className="adsbygoogle"
      style={{ display: 'inline-block', width: '728px', height: '90px' }}
      data-ad-client="ca-pub-REPLACE_WITH_PUBLISHER_ID"
      data-ad-slot={slotId}
    />
  )
}

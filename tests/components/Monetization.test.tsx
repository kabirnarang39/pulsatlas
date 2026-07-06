import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AdSlot } from '@/components/AdSlot'
import { SupportLink } from '@/components/SupportLink'

describe('AdSlot', () => {
  it('renders an ins.adsbygoogle element with the given slot id', () => {
    render(<AdSlot slotId="1234567890" />)
    const ins = document.querySelector('ins.adsbygoogle')
    expect(ins).toHaveAttribute('data-ad-slot', '1234567890')
  })

  it('does not throw when adsbygoogle push fails', () => {
    Object.defineProperty(window, 'adsbygoogle', {
      value: {
        push: () => {
          throw new Error('blocked')
        },
      },
      writable: true,
    })
    expect(() => render(<AdSlot slotId="1234567890" />)).not.toThrow()
  })
})

describe('SupportLink', () => {
  it('links to a UPI payment request', () => {
    render(<SupportLink />)
    const link = screen.getByLabelText('Support Pulsatlas via UPI')
    expect(link).toHaveAttribute('href', 'upi://pay?pa=8448337343@upi&pn=Pulsatlas')
  })
})

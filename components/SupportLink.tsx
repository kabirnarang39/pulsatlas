export function SupportLink() {
  const vpa = '8448337343@upi'
  const payeeName = encodeURIComponent('Pulsatlas')
  const upiLink = `upi://pay?pa=${vpa}&pn=${payeeName}`

  return (
    <a
      href={upiLink}
      aria-label="Support Pulsatlas via UPI"
    >
      ☕ Support Pulsatlas
    </a>
  )
}

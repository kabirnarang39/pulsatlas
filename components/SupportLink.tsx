export function SupportLink() {
  const vpa = '8448337343@upi'
  const payeeName = encodeURIComponent('Pulsatlas')
  const upiLink = `upi://pay?pa=${vpa}&pn=${payeeName}`

  return (
    <a
      href={upiLink}
      aria-label="Support Pulsatlas via UPI"
      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-card px-3 py-1.5 text-sm font-medium text-foreground transition duration-150 ease hover:border-accent hover:text-accent active:scale-[0.97]"
    >
      ☕ Support Pulsatlas
    </a>
  )
}

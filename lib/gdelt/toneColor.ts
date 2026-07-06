const STOPS = [
  { tone: -10, color: [239, 68, 68] as const }, // #EF4444 destructive
  { tone: 0, color: [148, 163, 184] as const }, // #94A3B8 muted
  { tone: 10, color: [34, 197, 94] as const }, // #22C55E cooperation
]

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function toHex(channel: number): string {
  return Math.round(channel).toString(16).padStart(2, '0')
}

export function toneColor(avgTone: number): string {
  const clamped = Math.max(-10, Math.min(10, avgTone))
  const [from, to] = clamped <= 0 ? [STOPS[0], STOPS[1]] : [STOPS[1], STOPS[2]]
  const t = (clamped - from.tone) / (to.tone - from.tone)
  const [r, g, b] = from.color.map((channel, i) => lerp(channel, to.color[i], t))
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

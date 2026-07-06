import type { Config } from 'tailwindcss'

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        foreground: 'var(--color-foreground)',
        card: 'var(--color-card)',
        accent: 'var(--color-accent)',
        muted: 'var(--color-muted)',
        destructive: 'var(--color-destructive)',
      },
      fontFamily: {
        heading: ['Space Grotesk', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      },
    },
  },
} satisfies Config

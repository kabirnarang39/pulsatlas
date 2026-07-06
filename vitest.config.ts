import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // ponytail: Node 22+'s built-in `localStorage` global shadows jsdom's
    // implementation, breaking `.clear()` etc. Disable it in the worker so
    // jsdom's own Storage wins. Remove if Node drops/changes this default.
    execArgv: ['--no-experimental-webstorage'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})

import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// ponytail: vitest globals are off, so RTL's auto-cleanup (which relies on a
// global afterEach) never registers. Wire it here once for every test file.
afterEach(cleanup)

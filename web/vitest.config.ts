import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.{ts,tsx}'],
    // Non-UTC, no-DST zone (fixed +3:00 since 2014): catches local-time
    // formatting/grouping bugs that UTC would hide (spec: guest slots render
    // in the viewer's local time).
    env: { TZ: 'Europe/Moscow' },
  },
})

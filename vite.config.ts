/// <reference types="vitest/config" />
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    reporters: ['verbose'],
    // Print full interpolated test names (it.each $values) instead of truncating at 40 chars.
    taskTitleValueFormatTruncate: 0,
    setupFiles: ['./src/test/setup.ts'],
  },
})

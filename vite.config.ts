import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { engineAnalysisPlugin } from './server/engine-analysis.ts'

export default defineConfig({
  plugins: [react(), engineAnalysisPlugin()],
  server: { host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
})

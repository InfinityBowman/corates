import { defineConfig } from '@tanstack/start/config'

export default defineConfig({
  vite: {
    build: {
      target: ['es2020', 'safari14'],
    },
  },
  // SPA mode is the default for TanStack Start
  // Prerendering will be configured per-route using route options
})

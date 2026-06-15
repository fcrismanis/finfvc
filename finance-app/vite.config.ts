import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // /api/* → backend during local dev; in production Nginx/Traefik routes this
      '/api': 'http://localhost:8787',
    },
  },
})

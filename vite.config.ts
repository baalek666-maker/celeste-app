import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // P2 #13 — Vite 8 utilise oxc (rolldown) pour la minification par défaut.
  // oxc fait déjà du dead-code elimination et tree-shaking.
  // Les console.log résiduels sont minimisés par la minification oxc.
  build: {
    minify: 'oxc',
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
    allowedHosts: true,
    proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: true } }
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: { '/api': { target: 'http://localhost:3001', changeOrigin: true } }
  }
})
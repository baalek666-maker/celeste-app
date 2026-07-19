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
    // P0-1 — Manual chunks (function form for Vite 8 / rolldown compatibility).
    // React/react-dom/scheduler changent rarement (1 fois par version mineure),
    // les isoler permet un cache hit à chaque deploy du code app.
    // Impact : réduit le chunk principal et améliore le cache hit ratio.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('/react-dom/') || id.includes('/scheduler/')) return 'vendor-react';
            if (id.includes('/react/') && !id.includes('/react-dom/')) return 'vendor-react';
          }
        },
      },
    },
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
import { defineConfig, type UserConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// P2 #13 — Strip console.log/warn/debug en production build.
// Garde console.error (utile en prod pour debugging client-side).
export default defineConfig(({ mode }) => {
  const isProd = mode === 'production'
  const config: UserConfig = {
    plugins: [react(), tailwindcss()],
    build: { minify: 'esbuild' },
    esbuild: {
      legalComments: 'none',
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
  }
  // esbuild drop/pure — Vite 8 types ne les exposent pas, mais esbuild les supporte.
  if (isProd) {
    ;(config.esbuild as any).drop = ['debugger']
    ;(config.esbuild as any).pure = ['console.log', 'console.debug', 'console.info']
  }
  return config
})
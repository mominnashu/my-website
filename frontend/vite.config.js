import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // Use IPv4 explicitly so Windows localhost resolution cannot select an
        // address family the backend is not listening on (which yields proxy 502s).
        target: process.env.RISKPROTECT_API_TARGET || 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
})

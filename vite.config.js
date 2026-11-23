import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ຕອນພັດທະນາ (npm run dev) ສົ່ງ /api ໄປຫາ server (npm run server) ທີ່ port 8080
const API_TARGET = process.env.API_TARGET || 'http://localhost:8080'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: false },
    },
  },
  build: {
    chunkSizeWarningLimit: 700,
  },
})

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Configuración de pruebas: usa jsdom para simular el navegador (document, window)
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    globals: false,
  },
})
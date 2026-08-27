import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// El backend en PHP para desarrollo. En producción no hace falta nada de esto:
// la API se publica en la misma carpeta que la tienda y el navegador la pide al
// mismo dominio, así que /api resuelve solo.
const API_LOCAL = 'http://127.0.0.1:8787'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      // Vite sirve la interfaz en 5254 y PHP la API en 8787. Sin este puente,
      // el navegador trataría /api como una ruta de la aplicación y recibiría
      // el HTML de la tienda en vez de JSON.
      '/api': { target: API_LOCAL, changeOrigin: false },
      // Las imágenes que se suben desde el panel también las sirve PHP.
      '/medios': { target: API_LOCAL, changeOrigin: false },
    },
  },
  build: {
    target: 'es2019',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          icons: ['lucide-react'],
        },
      },
    },
  },
})

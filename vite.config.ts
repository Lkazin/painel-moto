import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    rolldownOptions: {
      output: {
        // Separa as dependências grandes do código do aplicativo.
        // Melhora o cache do navegador e evita um único bloco gigante.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (/[\\/]react(?:-dom)?[\\/]/.test(id)) return 'react';
            if (/[\\/]lucide-react[\\/]/.test(id)) return 'icons';
            if (/[\\/]@capacitor[\\/]/.test(id)) return 'capacitor';
            return 'vendor';
          }
        }
      }
    }
  }
})

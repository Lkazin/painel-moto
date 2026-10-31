import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App.tsx'

// Registro do Service Worker para suporte a PWA (Instalação no celular)
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && (import.meta.env.PROD || !import.meta.env.DEV)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Falha ao registrar Service Worker:', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

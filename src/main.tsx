import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './App.tsx'
import { AppUpdateNotice } from './components/AppUpdateNotice'
import { ExperienceRuntime } from './components/ExperienceRuntime'
import { UpdateNotificationRuntime } from './components/UpdateNotificationRuntime'

// Registro universal do Service Worker para suporte a PWA (Instalação no celular Android e iOS)
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Falha ao registrar Service Worker:', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ExperienceRuntime />
    <UpdateNotificationRuntime />
    <AppUpdateNotice />
    <App />
  </StrictMode>,
)

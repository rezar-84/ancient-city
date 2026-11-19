import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// production only: media cache (public/sw.js); dev keeps Vite's normal uncached serving
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* unsupported / blocked */ }) })
}
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

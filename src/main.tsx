import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { StoreProvider } from './store/StoreContext'
import './styles/index.css'

// ── Pantalla de carga ────────────────────────────────────────────────────────
// Se muestra desde el HTML (antes de que React exista) y se retira cuando la app
// está montada. Mínimo 1.1 s para que no parpadee; máximo ~2 s.
const MIN_BOOT_MS = 1100
const start = performance.now()

function hideBoot() {
  const boot = document.getElementById('gg-boot')
  if (!boot) return
  const wait = Math.max(0, MIN_BOOT_MS - (performance.now() - start))
  window.setTimeout(() => {
    boot.dataset.hide = 'true'
    window.setTimeout(() => boot.remove(), 600)
  }, wait)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <StoreProvider>
        <App onReady={hideBoot} />
      </StoreProvider>
    </BrowserRouter>
  </StrictMode>
)

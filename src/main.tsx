import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { StoreProvider } from './store/StoreContext'
import { CatalogoProvider } from './hooks/useCatalogo'
import { AuthProvider } from './hooks/useAuth'
import { AvisosProvider } from './components/admin/Avisos'
import { ConfirmarProvider } from './components/admin/Modal'
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

// ── Proveedores ──────────────────────────────────────────────────────────────
// El orden importa:
//   AvisosProvider    notificaciones; lo usan tanto el panel como los servicios
//   ConfirmarProvider diálogos de confirmación de acciones destructivas
//   AuthProvider      sesión del panel (no interviene en la tienda)
//   CatalogoProvider  datos de la tienda, leídos de la base de datos o del
//                     catálogo incluido; es la fuente que comparten tienda y panel
//   StoreProvider     carrito y favoritos; necesita el catálogo ya disponible
//                     para resolver cada línea guardada
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AvisosProvider>
        <ConfirmarProvider>
          <AuthProvider>
            <CatalogoProvider>
              <StoreProvider>
                <App onReady={hideBoot} />
              </StoreProvider>
            </CatalogoProvider>
          </AuthProvider>
        </ConfirmarProvider>
      </AvisosProvider>
    </BrowserRouter>
  </StrictMode>
)

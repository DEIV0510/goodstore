import { Suspense, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Layout from '@/components/layout/Layout'
import PageLoader from '@/components/ui/PageLoader'

// ─────────────────────────────────────────────────────────────────────────────
// Envoltorio de la tienda pública.
//
// Reutiliza el <Layout> que ya existía (encabezado, pie, carrito, avisos): la
// experiencia del cliente no cambia. Lo único nuevo es que ahora es una ruta
// con <Outlet>, para poder colgar el panel de un árbol distinto.
// ─────────────────────────────────────────────────────────────────────────────

/** Al cambiar de ruta: sube al inicio y devuelve el foco al contenido. */
function EfectosDeRuta() {
  const { pathname, search, hash } = useLocation()
  useEffect(() => {
    if (hash) return
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    document.getElementById('contenido')?.focus({ preventScroll: true })
  }, [pathname, search, hash])
  return null
}

export default function PublicLayout() {
  // El panel marca el documento con `gg-admin` para aplicar su tema claro.
  // Al volver a la tienda esa marca se retira, por si se llegó aquí navegando
  // desde el panel sin recargar.
  useEffect(() => {
    document.documentElement.classList.remove('gg-admin')
  }, [])

  return (
    <Layout>
      <EfectosDeRuta />
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </Layout>
  )
}

import { Suspense, lazy, useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import Layout from '@/components/layout/Layout'
import PageLoader from '@/components/ui/PageLoader'
import Home from '@/pages/Home'

const Catalog = lazy(() => import('@/pages/Catalog'))
const ProductPage = lazy(() => import('@/pages/ProductPage'))
const Usados = lazy(() => import('@/pages/Usados'))
const Favoritos = lazy(() => import('@/pages/Favoritos'))
const NotFound = lazy(() => import('@/pages/NotFound'))

/** Al cambiar de ruta: sube al inicio y devuelve el foco al contenido. */
function RouteEffects() {
  const { pathname, search, hash } = useLocation()
  useEffect(() => {
    if (hash) return
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    document.getElementById('contenido')?.focus({ preventScroll: true })
  }, [pathname, search, hash])
  return null
}

export default function App({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    onReady()
  }, [onReady])

  return (
    <Layout>
      <RouteEffects />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/catalogo" element={<Catalog />} />
          <Route path="/producto/:slug" element={<ProductPage />} />
          <Route path="/usados" element={<Usados />} />
          <Route path="/favoritos" element={<Favoritos />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Layout>
  )
}

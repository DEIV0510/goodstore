import { Suspense, lazy, useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import PublicLayout from '@/layouts/PublicLayout'
import PageLoader from '@/components/ui/PageLoader'
import Home from '@/pages/public/Home'
import RutaProtegida from '@/pages/admin/RutaProtegida'

// ─────────────────────────────────────────────────────────────────────────────
// Rutas de la aplicación.
//
// Dos zonas dentro del mismo proyecto:
//
//   /            tienda pública — cualquiera
//   /admin/*     panel privado  — solo con sesión iniciada
//
// Todo el panel se carga bajo demanda: un cliente que entra a comprar no
// descarga ni un kilobyte del código de administración.
// ─────────────────────────────────────────────────────────────────────────────

// ── Tienda ───────────────────────────────────────────────────────────────────
const Catalog = lazy(() => import('@/pages/public/Catalog'))
const ProductPage = lazy(() => import('@/pages/public/ProductPage'))
const Usados = lazy(() => import('@/pages/public/Usados'))
const Favoritos = lazy(() => import('@/pages/public/Favoritos'))
const Pago = lazy(() => import('@/pages/public/Pago'))
const NotFound = lazy(() => import('@/pages/public/NotFound'))

// ── Panel ────────────────────────────────────────────────────────────────────
const Login = lazy(() => import('@/pages/admin/Login'))
const AdminLayout = lazy(() => import('@/layouts/AdminLayout'))
const Panel = lazy(() => import('@/pages/admin/Panel'))
const Productos = lazy(() => import('@/pages/admin/Productos'))
const ProductoForm = lazy(() => import('@/pages/admin/ProductoForm'))
const Inventario = lazy(() => import('@/pages/admin/Inventario'))
const Categorias = lazy(() => import('@/pages/admin/Categorias'))
const Pedidos = lazy(() => import('@/pages/admin/Pedidos'))
const PedidoDetalle = lazy(() => import('@/pages/admin/PedidoDetalle'))
const Clientes = lazy(() => import('@/pages/admin/Clientes'))
const Contenido = lazy(() => import('@/pages/admin/Contenido'))
const Banners = lazy(() => import('@/pages/admin/Banners'))
const Preguntas = lazy(() => import('@/pages/admin/Preguntas'))
const Whatsapp = lazy(() => import('@/pages/admin/Whatsapp'))
const Ajustes = lazy(() => import('@/pages/admin/Ajustes'))
const Administradores = lazy(() => import('@/pages/admin/Administradores'))
const Historial = lazy(() => import('@/pages/admin/Historial'))
const Perfil = lazy(() => import('@/pages/admin/Perfil'))

export default function App({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    onReady()
  }, [onReady])

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* ── Tienda pública ────────────────────────────────────────────── */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/catalogo" element={<Catalog />} />
          <Route path="/producto/:slug" element={<ProductPage />} />
          <Route path="/usados" element={<Usados />} />
          <Route path="/favoritos" element={<Favoritos />} />
          {/* Vuelta de la pasarela. La abre Wompi, no un enlace de la tienda. */}
          <Route path="/pago" element={<Pago />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        {/* ── Acceso al panel ───────────────────────────────────────────────
            Fuera del layout del panel: son pantallas completas y no deben
            mostrar la barra lateral a quien todavía no se identificó.      */}
        <Route path="/admin/login" element={<Login />} />

        {/* ── Panel privado ─────────────────────────────────────────────── */}
        <Route
          path="/admin"
          element={
            <RutaProtegida>
              <AdminLayout />
            </RutaProtegida>
          }
        >
          <Route index element={<Panel />} />
          <Route path="productos" element={<Productos />} />
          <Route path="productos/nuevo" element={<ProductoForm />} />
          <Route path="productos/:id" element={<ProductoForm />} />
          <Route path="inventario" element={<Inventario />} />
          <Route path="categorias" element={<Categorias />} />
          <Route path="contenido" element={<Contenido />} />
          <Route path="banners" element={<Banners />} />
          <Route path="faq" element={<Preguntas />} />
          <Route path="perfil" element={<Perfil />} />

          {/* Gestión del negocio: admin y super_admin */}
          <Route
            path="pedidos"
            element={
              <RutaProtegida roles={['super_admin', 'admin']}>
                <Pedidos />
              </RutaProtegida>
            }
          />
          <Route
            path="pedidos/:id"
            element={
              <RutaProtegida roles={['super_admin', 'admin']}>
                <PedidoDetalle />
              </RutaProtegida>
            }
          />
          <Route
            path="clientes"
            element={
              <RutaProtegida roles={['super_admin', 'admin']}>
                <Clientes />
              </RutaProtegida>
            }
          />
          <Route
            path="whatsapp"
            element={
              <RutaProtegida roles={['super_admin', 'admin']}>
                <Whatsapp />
              </RutaProtegida>
            }
          />
          <Route
            path="historial"
            element={
              <RutaProtegida roles={['super_admin', 'admin']}>
                <Historial />
              </RutaProtegida>
            }
          />

          {/* Configuración crítica: solo super_admin */}
          <Route
            path="ajustes"
            element={
              <RutaProtegida roles={['super_admin']}>
                <Ajustes />
              </RutaProtegida>
            }
          />
          <Route
            path="administradores"
            element={
              <RutaProtegida roles={['super_admin']}>
                <Administradores />
              </RutaProtegida>
            }
          />
        </Route>
      </Routes>
    </Suspense>
  )
}

import {
  Boxes,
  ChevronDown,
  ClipboardList,
  ExternalLink,
  FolderTree,
  Gauge,
  HelpCircle,
  Images,
  LayoutTemplate,
  LogOut,
  Menu,
  MessageCircle,
  ScrollText,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import {
  ETIQUETA_ROL,
  puedeConfigurar,
  puedeVerNegocio,
} from '@/services/autenticacion'
import type { AdminRole } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Estructura del panel.
//
// Nada que ver con la tienda: barra lateral fija en escritorio y cajón lateral
// en móvil. Cada apartado del menú se muestra solo si el rol puede usarlo, y
// además la base de datos lo vuelve a comprobar por su cuenta.
// ─────────────────────────────────────────────────────────────────────────────

interface Apartado {
  a: string
  texto: string
  icono: LucideIcon
  /** Sin función, lo ve cualquier rol. */
  visible?: (rol: AdminRole) => boolean
}

const SECCIONES: { grupo: string; items: Apartado[] }[] = [
  {
    grupo: '',
    items: [{ a: '/admin', texto: 'Panel', icono: Gauge }],
  },
  {
    grupo: 'Catálogo',
    items: [
      { a: '/admin/productos', texto: 'Productos', icono: ShoppingBag },
      { a: '/admin/inventario', texto: 'Inventario', icono: Boxes },
      { a: '/admin/categorias', texto: 'Categorías', icono: FolderTree },
    ],
  },
  {
    grupo: 'Ventas',
    items: [
      { a: '/admin/pedidos', texto: 'Pedidos', icono: ClipboardList, visible: puedeVerNegocio },
      { a: '/admin/clientes', texto: 'Clientes', icono: Users, visible: puedeVerNegocio },
    ],
  },
  {
    grupo: 'Contenido',
    items: [
      { a: '/admin/contenido', texto: 'Portada', icono: LayoutTemplate },
      { a: '/admin/banners', texto: 'Banners', icono: Images },
      { a: '/admin/faq', texto: 'Preguntas', icono: HelpCircle },
    ],
  },
  {
    grupo: 'Configuración',
    items: [
      { a: '/admin/whatsapp', texto: 'WhatsApp', icono: MessageCircle, visible: puedeVerNegocio },
      { a: '/admin/ajustes', texto: 'General', icono: Settings, visible: puedeConfigurar },
      {
        a: '/admin/administradores',
        texto: 'Administradores',
        icono: ShieldCheck,
        visible: puedeConfigurar,
      },
      { a: '/admin/historial', texto: 'Historial', icono: ScrollText, visible: puedeVerNegocio },
    ],
  },
]

export default function AdminLayout() {
  const { perfil, cerrarSesion } = useAuth()
  const { pathname } = useLocation()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [cuentaAbierta, setCuentaAbierta] = useState(false)
  const cuenta = useRef<HTMLDivElement>(null)

  // Marca el documento para que se apliquen los estilos claros del panel y se
  // retiren al volver a la tienda.
  useEffect(() => {
    document.documentElement.classList.add('gg-admin')
    return () => document.documentElement.classList.remove('gg-admin')
  }, [])

  // Al navegar: se cierra el cajón y el contenido vuelve arriba.
  useEffect(() => {
    setMenuAbierto(false)
    setCuentaAbierta(false)
    document.getElementById('adm-contenido')?.scrollTo({ top: 0 })
    window.scrollTo({ top: 0 })
  }, [pathname])

  useEffect(() => {
    if (!cuentaAbierta) return
    function fuera(e: MouseEvent) {
      if (!cuenta.current?.contains(e.target as Node)) setCuentaAbierta(false)
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [cuentaAbierta])

  const rol = perfil?.role ?? 'editor'

  const menu = (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Secciones del panel">
      {SECCIONES.map((seccion) => {
        const items = seccion.items.filter((i) => !i.visible || i.visible(rol))
        if (items.length === 0) return null
        return (
          <div key={seccion.grupo || 'inicio'}>
            {seccion.grupo && (
              <p className="mb-1.5 px-3 text-[10.5px] font-bold uppercase tracking-[.16em] text-white/35">
                {seccion.grupo}
              </p>
            )}
            <ul className="space-y-0.5">
              {items.map(({ a, texto, icono: Icono }) => (
                <li key={a}>
                  <NavLink
                    to={a}
                    end={a === '/admin'}
                    className={({ isActive }) =>
                      `adm-nav-item ${isActive ? 'adm-nav-activo' : ''}`
                    }
                  >
                    <Icono className="h-[17px] w-[17px] shrink-0" aria-hidden="true" />
                    {texto}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </nav>
  )

  const marca = (
    <div className="flex items-center gap-2.5 px-4 py-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gold-500 font-display text-[15px] font-black text-ink-900">
        GG
      </span>
      <span className="min-w-0">
        <span className="block font-display text-[14px] font-black leading-none tracking-tight text-white">
          GOOD GAME
        </span>
        <span className="mt-1 block text-[10.5px] font-bold uppercase tracking-[.2em] text-gold-500">
          Admin panel
        </span>
      </span>
    </div>
  )

  const piePerfil = (
    <div className="border-t border-white/10 p-3" ref={cuenta}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setCuentaAbierta((v) => !v)}
          aria-expanded={cuentaAbierta}
          aria-haspopup="menu"
          className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[.07]"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-700 text-[12px] font-bold uppercase text-white">
            {(perfil?.name || perfil?.email || '?').slice(0, 2)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-white">
              {perfil?.name || perfil?.email}
            </span>
            <span className="block truncate text-[11px] text-white/45">
              {perfil ? ETIQUETA_ROL[perfil.role] : ''}
            </span>
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-white/40 transition-transform ${
              cuentaAbierta ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </button>

        {cuentaAbierta && (
          <div
            role="menu"
            className="absolute bottom-full left-0 right-0 mb-1 overflow-hidden rounded-lg border border-white/10 bg-ink-800 shadow-xl"
          >
            <Link to="/admin/perfil" role="menuitem" className="adm-nav-item rounded-none">
              <Users className="h-[17px] w-[17px]" aria-hidden="true" />
              Mi perfil
            </Link>
            <Link
              to="/"
              role="menuitem"
              target="_blank"
              rel="noopener noreferrer"
              className="adm-nav-item rounded-none"
            >
              <ExternalLink className="h-[17px] w-[17px]" aria-hidden="true" />
              Ver la tienda
            </Link>
            {/* Cerrar sesión va separado del resto: es la acción que saca de aquí */}
            <div className="border-t border-white/10">
              <button
                type="button"
                role="menuitem"
                onClick={() => void cerrarSesion()}
                className="adm-nav-item w-full rounded-none text-alert-400 hover:bg-alert-500/15 hover:text-alert-400"
              >
                <LogOut className="h-[17px] w-[17px]" aria-hidden="true" />
                Cerrar sesión
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex min-h-dvh bg-slate-100">
      {/* ── Barra lateral fija (escritorio) ───────────────────────────────── */}
      <aside className="adm-sidebar fixed inset-y-0 left-0 z-40 hidden w-[248px] border-r border-white/10 lg:flex">
        {marca}
        {menu}
        {piePerfil}
      </aside>

      {/* ── Cajón lateral (móvil y tablet) ────────────────────────────────── */}
      {menuAbierto && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Cerrar el menú"
            onClick={() => setMenuAbierto(false)}
            className="absolute inset-0 cursor-default bg-blue-950/60"
          />
          <aside className="adm-sidebar absolute inset-y-0 left-0 w-[268px] max-w-[86vw] animate-slide-left shadow-2xl">
            <div className="flex items-center justify-between pr-2">
              {marca}
              <button
                type="button"
                onClick={() => setMenuAbierto(false)}
                aria-label="Cerrar el menú"
                className="grid h-9 w-9 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
              >
                <X className="h-[18px] w-[18px]" aria-hidden="true" />
              </button>
            </div>
            {menu}
            {piePerfil}
          </aside>
        </div>
      )}

      {/* ── Contenido ─────────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-[248px]">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setMenuAbierto(true)}
            aria-label="Abrir el menú"
            className="adm-icono"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
          <span className="font-display text-[14px] font-black tracking-tight text-slate-900">
            GOOD GAME
            <span className="ml-2 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">
              Admin
            </span>
          </span>
        </header>

        <main id="adm-contenido" className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6">
          <div className="mx-auto w-full max-w-[1180px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

import { Heart, Menu, MessageCircle, Search, ShoppingCart, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Logo from '@/components/brand/Logo'
import SearchOverlay from './SearchOverlay'
import { NAV } from './navigation'
import { MESSAGES, site, waLink } from '@/data/site'
import { useStore } from '@/store/StoreContext'

export default function Header() {
  const { cartCount, favorites, setCartOpen, bump } = useStore()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const { pathname, search } = useLocation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => setMenuOpen(false), [pathname, search])

  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  // Atajo de teclado: "/" abre el buscador
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const iconBtn =
    'relative grid h-11 w-11 place-items-center rounded-xl text-white/75 transition-colors hover:bg-white/10 hover:text-white'

  return (
    <>
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[80] focus:rounded-lg focus:bg-gold-500 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-ink-900"
      >
        Saltar al contenido
      </a>

      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'border-b border-white/10 bg-ink-900/88 shadow-[0_10px_30px_-18px_rgba(0,0,0,.9)] backdrop-blur-xl'
            : 'border-b border-transparent bg-gradient-to-b from-ink-900/55 via-ink-900/20 to-transparent'
        }`}
      >
        <div className="gg-container flex h-[var(--gg-header)] items-center gap-2">
          <Link
            to="/"
            aria-label="GOOD GAME, ir al inicio"
            className="mr-1 shrink-0 rounded-lg py-1"
          >
            <Logo size="sm" className="lg:hidden" />
            <Logo size="md" className="hidden lg:inline-flex" />
          </Link>

          {/* Navegación de escritorio */}
          <nav aria-label="Principal" className="ml-2 hidden min-w-0 flex-1 xl:block">
            <ul className="flex items-center gap-0.5">
              {NAV.map((item) => {
                const active = item.match?.(pathname, search) ?? false
                return (
                  <li key={item.label}>
                    <Link
                      to={item.to}
                      aria-current={active ? 'page' : undefined}
                      className={`relative block whitespace-nowrap rounded-lg px-2.5 py-2 text-[13px] font-semibold transition-colors ${
                        active ? 'text-gold-500' : 'text-white/75 hover:bg-white/[.07] hover:text-white'
                      }`}
                    >
                      {item.label}
                      {active && (
                        <span
                          className="absolute inset-x-2.5 -bottom-0.5 h-0.5 rounded-full bg-gold-500"
                          aria-hidden="true"
                        />
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className={iconBtn}
              aria-label="Buscar juegos"
            >
              <Search className="h-5 w-5" aria-hidden="true" />
            </button>

            <Link
              to="/favoritos"
              className={`${iconBtn} hidden sm:grid`}
              aria-label={`Favoritos${favorites.length ? `, ${favorites.length} guardados` : ''}`}
            >
              <Heart className="h-5 w-5" aria-hidden="true" />
              {favorites.length > 0 && (
                <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-alert-500 px-1 text-[10px] font-black text-white">
                  {favorites.length > 99 ? '99+' : favorites.length}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className={iconBtn}
              aria-label={`Carrito${cartCount ? `, ${cartCount} productos` : ' vacío'}`}
            >
              <ShoppingCart
                key={bump}
                className={`h-5 w-5 ${bump ? 'animate-cart-bump' : ''}`}
                aria-hidden="true"
              />
              {cartCount > 0 && (
                <span className="absolute right-1 top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-gold-500 px-1 text-[10px] font-black text-ink-900">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </button>

            <a
              href={waLink(MESSAGES.general)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-wa ml-1.5 hidden h-11 min-h-0 px-3.5 text-xs lg:inline-flex"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              WhatsApp
            </a>

            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className={`${iconBtn} xl:hidden`}
              aria-label="Abrir menú"
              aria-expanded={menuOpen}
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Menú móvil ─────────────────────────────────────────────────────── */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60] xl:hidden">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Cerrar menú"
            onClick={() => setMenuOpen(false)}
            className="absolute inset-0 h-full w-full animate-fade-in cursor-default bg-ink-900/85 backdrop-blur-sm"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menú"
            className="absolute inset-y-0 right-0 flex w-[min(340px,88vw)] animate-slide-left flex-col border-l border-white/10 bg-ink-800 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3.5">
              <Logo size="sm" />
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Cerrar menú"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <nav aria-label="Menú móvil" className="flex-1 overflow-y-auto p-3">
              <ul className="space-y-1">
                {NAV.map((item) => {
                  const active = item.match?.(pathname, search) ?? false
                  return (
                    <li key={item.label}>
                      <Link
                        to={item.to}
                        aria-current={active ? 'page' : undefined}
                        className={`flex min-h-[48px] items-center rounded-xl px-3.5 font-display text-[15px] font-bold transition-colors ${
                          active
                            ? 'bg-gold-500/12 text-gold-500'
                            : 'text-white/85 hover:bg-white/[.07] hover:text-white'
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  )
                })}
                <li className="pt-2">
                  <Link
                    to="/favoritos"
                    className="flex min-h-[48px] items-center gap-2 rounded-xl px-3.5 font-display text-[15px] font-bold text-white/85 transition-colors hover:bg-white/[.07]"
                  >
                    <Heart className="h-4 w-4" aria-hidden="true" />
                    Favoritos
                    {favorites.length > 0 && (
                      <span className="ml-auto rounded-full bg-alert-500 px-2 py-0.5 text-[11px] font-black text-white">
                        {favorites.length}
                      </span>
                    )}
                  </Link>
                </li>
              </ul>
            </nav>

            <div className="space-y-2 border-t border-white/10 p-4 pb-safe">
              <a
                href={waLink(MESSAGES.general)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-wa w-full"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Escríbenos por WhatsApp
              </a>
              <p className="text-center text-2xs text-white/45">
                {site.whatsappDisplay} · {site.shippingLabel}
              </p>
            </div>
          </div>
        </div>
      )}

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}

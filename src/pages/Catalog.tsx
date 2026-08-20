import { ChevronRight, Home, MessageCircle, SlidersHorizontal, Search, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ProductCard from '@/components/catalog/ProductCard'
import FilterPanel from '@/components/catalog/FilterPanel'
import Drawer from '@/components/ui/Drawer'
import { CardSkeleton } from '@/components/ui/PageLoader'
import { products } from '@/data/products'
import {
  PRICE_RANGES,
  SORTS,
  conditionLabel,
  genreLabel,
  platformLabel,
} from '@/data/taxonomy'
import { MESSAGES, waLink } from '@/data/site'
import {
  applyFilters,
  buildSearchIndex,
  countActive,
  fromSearchParams,
  sortProducts,
  toSearchParams,
  type FilterState,
} from '@/lib/filters'
import { pluralize } from '@/lib/format'
import { useSeo } from '@/lib/seo'
import type { SortKey } from '@/types'

const PAGE_SIZE = 24

const searchIndex = buildSearchIndex(products, {
  platform: platformLabel,
  genre: genreLabel,
})
const order = new Map(products.map((p, i) => [p.slug, i]))

/** Etiqueta legible de cada filtro activo, para los chips de arriba. */
function activeChips(f: FilterState) {
  const chips: { key: keyof FilterState; id: string; label: string }[] = []
  f.platforms.forEach((id) =>
    chips.push({ key: 'platforms', id, label: platformLabel(id) })
  )
  f.conditions.forEach((id) =>
    chips.push({ key: 'conditions', id, label: `Estado: ${conditionLabel(id)}` })
  )
  f.availability.forEach((id) =>
    chips.push({ key: 'availability', id, label: id === 'agotado' ? 'Agotado' : 'Disponible' })
  )
  f.genres.forEach((id) => chips.push({ key: 'genres', id, label: genreLabel(id) }))
  f.priceRanges.forEach((id) =>
    chips.push({
      key: 'priceRanges',
      id,
      label: PRICE_RANGES.find((r) => r.id === id)?.label ?? id,
    })
  )
  f.categories.forEach((id) => chips.push({ key: 'categories', id, label: `Categoría: ${id}` }))
  return chips
}

export default function Catalog() {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => fromSearchParams(params), [params])
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [queryDraft, setQueryDraft] = useState(filters.query)
  const gridTop = useRef<HTMLDivElement>(null)

  useSeo({
    title: 'Catálogo de videojuegos | GOOD GAME',
    description:
      'Explora el catálogo de GOOD GAME: videojuegos para PlayStation 5, PlayStation 4 y Nintendo Switch. Filtra por plataforma, género y disponibilidad.',
    path: '/catalogo',
  })

  useEffect(() => setQueryDraft(filters.query), [filters.query])

  const update = useCallback(
    (next: FilterState) => {
      setPending(true)
      setParams(toSearchParams(next), { replace: true })
      setVisible(PAGE_SIZE)
    },
    [setParams]
  )

  // Pequeño estado de carga para que el cambio de filtros se sienta responsivo
  useEffect(() => {
    if (!pending) return
    const t = window.setTimeout(() => setPending(false), 180)
    return () => window.clearTimeout(t)
  }, [pending, params])

  const toggle = useCallback(
    (key: keyof FilterState, id: string) => {
      const current = filters[key] as string[]
      const next = current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id]
      update({ ...filters, [key]: next } as FilterState)
    },
    [filters, update]
  )

  const reset = useCallback(() => {
    setQueryDraft('')
    update({ ...filters, platforms: [], conditions: [], genres: [], priceRanges: [], availability: [], categories: [], query: '' })
  }, [filters, update])

  const results = useMemo(() => {
    const filtered = applyFilters(products, filters, searchIndex)
    return sortProducts(filtered, filters.sort, order)
  }, [filters])

  const shown = results.slice(0, visible)
  const activeCount = countActive(filters)
  const chips = activeChips(filters)

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    update({ ...filters, query: queryDraft })
    gridTop.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  const panel = (
    <FilterPanel
      all={products}
      filters={filters}
      searchIndex={searchIndex}
      onToggle={toggle}
      onReset={reset}
      activeCount={activeCount}
    />
  )

  return (
    <div className="relative">
      {/* Cabecera */}
      <div className="relative overflow-hidden border-b border-white/10 bg-[linear-gradient(160deg,#0C1287_0%,#070A78_40%,#070C42_100%)]">
        <div className="pointer-events-none absolute inset-0 bg-tech opacity-40" aria-hidden="true" />
        <div className="gg-container relative py-8 sm:py-11">
          <nav aria-label="Ruta de navegación">
            <ol className="flex items-center gap-1.5 text-2xs font-semibold text-white/50">
              <li>
                <Link to="/" className="inline-flex items-center gap-1 hover:text-gold-500">
                  <Home className="h-3.5 w-3.5" aria-hidden="true" />
                  Inicio
                </Link>
              </li>
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
              <li aria-current="page" className="text-white/80">
                Catálogo
              </li>
            </ol>
          </nav>

          <h1
            className="mt-3 font-display text-3xl font-black tracking-tight sm:text-4xl"
            style={{ fontStretch: '110%' }}
          >
            Catálogo de videojuegos
          </h1>
          <p className="mt-2.5 max-w-2xl text-pretty text-sm text-white/65 sm:text-base">
{products.length} títulos físicos para PS5, PS4 y Nintendo Switch.
          </p>

          <form onSubmit={onSearchSubmit} className="mt-6 flex max-w-xl gap-2" role="search">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40"
                aria-hidden="true"
              />
              <input
                type="search"
                value={queryDraft}
                onChange={(e) => setQueryDraft(e.target.value)}
                placeholder="Busca por nombre, plataforma o género…"
                aria-label="Buscar en el catálogo"
                enterKeyHint="search"
                className="h-12 w-full rounded-xl border border-white/12 bg-ink-900/50 pl-10 pr-3 text-sm text-white outline-none transition-colors placeholder:text-white/35 focus:border-gold-500/60"
              />
            </div>
            <button type="submit" className="btn-primary h-12 min-h-0 px-5 text-sm">
              Buscar
            </button>
          </form>
        </div>
      </div>

      <div className="gg-container py-8" ref={gridTop}>
        <div className="lg:grid lg:grid-cols-[264px,minmax(0,1fr)] lg:gap-8">
          {/* Filtros (escritorio) */}
          <aside className="hidden lg:block">
            <div className="sticky top-[calc(var(--gg-header)+20px)] max-h-[calc(100dvh-var(--gg-header)-40px)] overflow-y-auto rounded-card border border-white/10 bg-ink-700/45 p-4">
              {panel}
            </div>
          </aside>

          <div className="min-w-0">
            {/* Barra de control */}
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="btn-secondary h-11 min-h-0 px-4 text-xs lg:hidden"
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                Filtros
                {activeCount > 0 && (
                  <span className="ml-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-gold-500 px-1 text-[10px] font-black text-ink-900">
                    {activeCount}
                  </span>
                )}
              </button>

              <p className="text-xs text-white/55" aria-live="polite">
                <span className="font-bold text-white">{results.length}</span>{' '}
                {results.length === 1 ? 'resultado' : 'resultados'}
                {results.length > visible && (
                  <span className="text-white/40"> · mostrando {shown.length}</span>
                )}
              </p>

              <div className="ml-auto flex items-center gap-2">
                <label htmlFor="orden" className="hidden text-xs font-semibold text-white/50 sm:block">
                  Ordenar por
                </label>
                <select
                  id="orden"
                  value={filters.sort}
                  onChange={(e) => update({ ...filters, sort: e.target.value as SortKey })}
                  className="h-11 rounded-xl border border-white/12 bg-ink-700 px-3 text-xs font-semibold text-white outline-none transition-colors focus:border-gold-500/60"
                >
                  {SORTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Chips de filtros activos */}
            {(chips.length > 0 || filters.query) && (
              <div className="mb-5 flex flex-wrap items-center gap-2">
                {filters.query && (
                  <button
                    type="button"
                    onClick={() => update({ ...filters, query: '' })}
                    className="inline-flex items-center gap-1.5 rounded-full border border-gold-500/40 bg-gold-500/12 px-3 py-1.5 text-2xs font-bold text-gold-500 transition-colors hover:bg-gold-500/20"
                  >
                    “{filters.query}”
                    <X className="h-3 w-3" aria-hidden="true" />
                    <span className="sr-only">Quitar búsqueda</span>
                  </button>
                )}
                {chips.map((c) => (
                  <button
                    key={`${c.key}-${c.id}`}
                    type="button"
                    onClick={() => toggle(c.key, c.id)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[.06] px-3 py-1.5 text-2xs font-bold text-white/80 transition-colors hover:border-alert-500/50 hover:text-white"
                  >
                    {c.label}
                    <X className="h-3 w-3" aria-hidden="true" />
                    <span className="sr-only">Quitar filtro {c.label}</span>
                  </button>
                ))}
                {activeCount > 1 && (
                  <button
                    type="button"
                    onClick={reset}
                    className="text-2xs font-bold text-white/45 underline-offset-4 hover:text-gold-500 hover:underline"
                  >
                    Limpiar todo
                  </button>
                )}
              </div>
            )}

            {/* Resultados */}
            {pending ? (
              <ul className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <li key={i}>
                    <CardSkeleton />
                  </li>
                ))}
              </ul>
            ) : results.length === 0 ? (
              <div className="surface flex flex-col items-center px-6 py-16 text-center">
                <span className="grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-white/[.04]">
                  <Search className="h-7 w-7 text-white/35" aria-hidden="true" />
                </span>
                <h2 className="mt-5 font-display text-xl font-black text-white">
                  No encontramos ese juego.
                </h2>
                <p className="mt-2.5 max-w-md text-pretty text-sm text-white/60">
                  Prueba con menos filtros o revisa la escritura. Si lo que buscas no está en
                  el catálogo, escríbenos: puede que lo tengamos o lo consigamos.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <button type="button" onClick={reset} className="btn-primary text-xs">
                    Volver a las categorías
                  </button>
                  <a
                    href={waLink(
                      filters.query
                        ? `Hola GOOD GAME 🎮, estoy buscando "${filters.query}". ¿Lo tienen disponible?`
                        : MESSAGES.general
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-wa text-xs"
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                    Preguntar por WhatsApp
                  </a>
                </div>
              </div>
            ) : (
              <>
                <ul className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-4">
                  {shown.map((p, i) => (
                    <li key={p.slug}>
                      <ProductCard product={p} priority={i < 4} />
                    </li>
                  ))}
                </ul>

                {results.length > visible && (
                  <div className="mt-9 flex flex-col items-center gap-3">
                    <p className="text-2xs text-white/45">
                      Mostrando {shown.length} de {pluralize(results.length, 'juego', 'juegos')}
                    </p>
                    <button
                      type="button"
                      onClick={() => setVisible((v) => v + PAGE_SIZE)}
                      className="btn-secondary px-8"
                    >
                      Ver más juegos
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Filtros (móvil) */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Filtros"
        labelId="filtros-title"
        footer={
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="btn-primary w-full"
          >
            Ver {results.length} {results.length === 1 ? 'resultado' : 'resultados'}
          </button>
        }
      >
        <div className="p-4">{panel}</div>
      </Drawer>
    </div>
  )
}

import { PRICE_RANGES } from '@/data/taxonomy'
import { normalize } from './format'
import type { Category, Condition, Genre, Platform, Product, SortKey } from '@/types'

export interface FilterState {
  platforms: Platform[]
  conditions: Condition[]
  genres: Genre[]
  priceRanges: string[]
  availability: ('disponible' | 'agotado')[]
  categories: Category[]
  query: string
  sort: SortKey
}

export const EMPTY_FILTERS: FilterState = {
  platforms: [],
  conditions: [],
  genres: [],
  priceRanges: [],
  availability: [],
  categories: [],
  query: '',
  sort: 'destacados',
}

// ── URL ⇄ estado ────────────────────────────────────────────────────────────
const list = (params: URLSearchParams, key: string) =>
  (params.get(key) ?? '').split(',').map((s) => s.trim()).filter(Boolean)

export function fromSearchParams(params: URLSearchParams): FilterState {
  const sort = (params.get('orden') ?? 'destacados') as SortKey
  return {
    platforms: list(params, 'plataforma') as Platform[],
    conditions: list(params, 'estado') as Condition[],
    genres: list(params, 'genero') as Genre[],
    priceRanges: list(params, 'precio'),
    availability: list(params, 'disponibilidad') as ('disponible' | 'agotado')[],
    categories: list(params, 'categoria') as Category[],
    query: params.get('q') ?? '',
    sort: ['destacados', 'recientes', 'precio-asc', 'precio-desc', 'nombre'].includes(sort)
      ? sort
      : 'destacados',
  }
}

export function toSearchParams(f: FilterState): URLSearchParams {
  const p = new URLSearchParams()
  if (f.platforms.length) p.set('plataforma', f.platforms.join(','))
  if (f.conditions.length) p.set('estado', f.conditions.join(','))
  if (f.genres.length) p.set('genero', f.genres.join(','))
  if (f.priceRanges.length) p.set('precio', f.priceRanges.join(','))
  if (f.availability.length) p.set('disponibilidad', f.availability.join(','))
  if (f.categories.length) p.set('categoria', f.categories.join(','))
  if (f.query.trim()) p.set('q', f.query.trim())
  if (f.sort !== 'destacados') p.set('orden', f.sort)
  return p
}

export const countActive = (f: FilterState) =>
  f.platforms.length +
  f.conditions.length +
  f.genres.length +
  f.priceRanges.length +
  f.availability.length +
  f.categories.length +
  (f.query.trim() ? 1 : 0)

// ── Predicados individuales ─────────────────────────────────────────────────
const inPriceRange = (price: number | null, ids: string[]) => {
  if (price === null) return false
  return ids.some((id) => {
    const r = PRICE_RANGES.find((x) => x.id === id)
    return r ? price >= r.min && price <= r.max : false
  })
}

const isAvailable = (p: Product) => p.stock === null || p.stock > 0

const matchesQuery = (p: Product, query: string, searchIndex: Map<string, string>) => {
  const term = normalize(query)
  if (!term) return true
  const hay = searchIndex.get(p.slug) ?? ''
  return term.split(/\s+/).filter(Boolean).every((w) => hay.includes(w))
}

type Facet = 'platforms' | 'conditions' | 'genres' | 'priceRanges' | 'availability' | 'categories'

/**
 * Aplica todos los filtros salvo el indicado en `except`.
 * Se usa para calcular los contadores de cada faceta como hacen las tiendas
 * grandes: el número que ves al lado de cada opción es lo que obtendrías si la
 * marcaras, manteniendo el resto de filtros.
 */
export function applyFilters(
  items: Product[],
  f: FilterState,
  searchIndex: Map<string, string>,
  except?: Facet
): Product[] {
  return items.filter((p) => {
    if (except !== 'platforms' && f.platforms.length && !f.platforms.includes(p.platform))
      return false
    if (except !== 'conditions' && f.conditions.length && !f.conditions.includes(p.condition))
      return false
    if (except !== 'genres' && f.genres.length && !f.genres.includes(p.genre)) return false
    if (except !== 'categories' && f.categories.length && !f.categories.includes(p.category))
      return false
    if (except !== 'priceRanges' && f.priceRanges.length && !inPriceRange(p.price, f.priceRanges))
      return false
    if (except !== 'availability' && f.availability.length) {
      const state = isAvailable(p) ? 'disponible' : 'agotado'
      if (!f.availability.includes(state)) return false
    }
    if (!matchesQuery(p, f.query, searchIndex)) return false
    return true
  })
}

export function sortProducts(items: Product[], sort: SortKey, order: Map<string, number>) {
  const copy = [...items]
  switch (sort) {
    case 'nombre':
      return copy.sort((a, b) => a.name.localeCompare(b.name, 'es'))
    case 'precio-asc':
      // Los productos sin precio se muestran al final: no se pueden ordenar.
      return copy.sort(
        (a, b) =>
          (a.price ?? Number.POSITIVE_INFINITY) - (b.price ?? Number.POSITIVE_INFINITY) ||
          a.name.localeCompare(b.name, 'es')
      )
    case 'precio-desc':
      return copy.sort(
        (a, b) =>
          (b.price ?? Number.NEGATIVE_INFINITY) - (a.price ?? Number.NEGATIVE_INFINITY) ||
          a.name.localeCompare(b.name, 'es')
      )
    case 'recientes':
      // "Más recientes" = últimos agregados al catálogo (final de products.ts).
      return copy.sort((a, b) => (order.get(b.slug) ?? 0) - (order.get(a.slug) ?? 0))
    case 'destacados':
    default:
      return copy.sort(
        (a, b) =>
          Number(b.featured) - Number(a.featured) ||
          Number(isAvailable(b)) - Number(isAvailable(a)) ||
          (order.get(a.slug) ?? 0) - (order.get(b.slug) ?? 0)
      )
  }
}

/** Índice de búsqueda precalculado (nombre + plataforma + género + tags). */
export function buildSearchIndex(
  items: Product[],
  labels: { platform: (p: Platform) => string; genre: (g: Genre) => string }
) {
  return new Map(
    items.map((p) => [
      p.slug,
      normalize(
        `${p.name} ${labels.platform(p.platform)} ${p.platform} ${labels.genre(p.genre)} ${p.tags.join(
          ' '
        )} ${p.description}`
      ),
    ])
  )
}

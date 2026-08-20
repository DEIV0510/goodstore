import { RotateCcw } from 'lucide-react'
import FilterGroup, { type Option } from './FilterGroup'
import { CONDITIONS, GENRES, PLATFORMS, PRICE_RANGES } from '@/data/taxonomy'
import { applyFilters, type FilterState } from '@/lib/filters'
import type { Product } from '@/types'

interface Props {
  all: Product[]
  filters: FilterState
  searchIndex: Map<string, string>
  onToggle: (key: keyof FilterState, id: string) => void
  onReset: () => void
  activeCount: number
}

const AVAILABILITY = [
  { id: 'disponible', label: 'Disponible' },
  { id: 'agotado', label: 'Agotado' },
]

export default function FilterPanel({
  all,
  filters,
  searchIndex,
  onToggle,
  onReset,
  activeCount,
}: Props) {
  /** Cuenta cuántos productos quedarían al marcar cada opción de una faceta. */
  const counts = (
    facet: Parameters<typeof applyFilters>[3],
    predicate: (p: Product, id: string) => boolean,
    ids: string[]
  ): Record<string, number> => {
    const base = applyFilters(all, filters, searchIndex, facet)
    const out: Record<string, number> = {}
    for (const id of ids) out[id] = base.filter((p) => predicate(p, id)).length
    return out
  }

  const platformCounts = counts('platforms', (p, id) => p.platform === id, PLATFORMS.map((x) => x.id))
  const conditionCounts = counts('conditions', (p, id) => p.condition === id, CONDITIONS.map((x) => x.id))
  const genreCounts = counts('genres', (p, id) => p.genre === id, GENRES.map((x) => x.id))
  const priceCounts = counts(
    'priceRanges',
    (p, id) => {
      const r = PRICE_RANGES.find((x) => x.id === id)
      return r !== undefined && p.price !== null && p.price >= r.min && p.price <= r.max
    },
    PRICE_RANGES.map((x) => x.id)
  )
  const availabilityCounts = counts(
    'availability',
    (p, id) => (p.stock === null || p.stock > 0 ? 'disponible' : 'agotado') === id,
    AVAILABILITY.map((x) => x.id)
  )

  const opts = (
    src: { id: string; label: string }[],
    map: Record<string, number>
  ): Option[] => src.map((x) => ({ ...x, count: map[x.id] ?? 0 }))

  return (
    <div>
      <div className="flex items-center justify-between gap-2 pb-1">
        <p className="font-display text-sm font-extrabold uppercase tracking-wider text-white">
          Filtros
        </p>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-2xs font-bold text-gold-500 transition-colors hover:bg-gold-500/10"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Limpiar ({activeCount})
          </button>
        )}
      </div>

      <FilterGroup
        title="Plataforma"
        options={opts(PLATFORMS, platformCounts)}
        selected={filters.platforms}
        onToggle={(id) => onToggle('platforms', id)}
      />

      <FilterGroup
        title="Estado"
        options={opts(CONDITIONS, conditionCounts)}
        selected={filters.conditions}
        onToggle={(id) => onToggle('conditions', id)}
        emptyNote="Todavía no marcamos nuevo/usado por título. Pregúntanos por WhatsApp y te confirmamos el estado exacto."
      />

      <FilterGroup
        title="Disponibilidad"
        options={opts(AVAILABILITY, availabilityCounts)}
        selected={filters.availability}
        onToggle={(id) => onToggle('availability', id)}
      />

      <FilterGroup
        title="Género"
        options={opts(GENRES, genreCounts)}
        selected={filters.genres}
        onToggle={(id) => onToggle('genres', id)}
      />

      <FilterGroup
        title="Precio"
        options={opts(PRICE_RANGES, priceCounts)}
        selected={filters.priceRanges}
        onToggle={(id) => onToggle('priceRanges', id)}
        defaultOpen={false}
        emptyNote="Los precios se confirman por WhatsApp, por eso este filtro aún no arroja resultados. Se activará solo cuando se publiquen los precios."
      />
    </div>
  )
}

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import ProductCard from '@/components/catalog/ProductCard'
import type { Product } from '@/types'

/**
 * Carrusel horizontal de productos. En móvil se desplaza con el dedo;
 * en escritorio aparecen flechas (solo si hay contenido fuera de vista).
 */
export default function ProductRow({
  items,
  showFeaturedBadge = true,
}: {
  items: Product[]
  showFeaturedBadge?: boolean
}) {
  const ref = useRef<HTMLUListElement>(null)
  const [edges, setEdges] = useState({ start: true, end: false })

  const update = useCallback(() => {
    const el = ref.current
    if (!el) return
    setEdges({
      start: el.scrollLeft <= 4,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
    })
  }, [])

  useEffect(() => {
    update()
    const el = ref.current
    if (!el) return
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [update, items])

  const scrollBy = (dir: 1 | -1) => {
    const el = ref.current
    if (!el) return
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.85), behavior: 'smooth' })
  }

  const arrow =
    'absolute top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/12 bg-ink-800/95 text-white shadow-card-hover backdrop-blur transition-all duration-200 hover:border-gold-500/50 hover:text-gold-500 disabled:pointer-events-none disabled:opacity-0 lg:grid'

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => scrollBy(-1)}
        disabled={edges.start}
        className={`${arrow} -left-4`}
        aria-label="Desplazar productos hacia la izquierda"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      </button>

      <ul
        ref={ref}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0"
      >
        {items.map((p, i) => (
          <li
            key={p.slug}
            className="w-[46%] min-w-[152px] max-w-[220px] shrink-0 snap-start sm:w-[31%] lg:w-[calc((100%-4*0.875rem)/5)]"
          >
            <ProductCard product={p} priority={i < 3} showFeaturedBadge={showFeaturedBadge} />
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => scrollBy(1)}
        disabled={edges.end}
        className={`${arrow} -right-4`}
        aria-label="Desplazar productos hacia la derecha"
      >
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  )
}

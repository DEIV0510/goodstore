import { CornerDownLeft, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ProductImage from '@/components/ui/ProductImage'
import { PlatformBadge } from '@/components/ui/Badges'
import { products } from '@/data/products'
import { genreLabel, platformLabel } from '@/data/taxonomy'
import { normalize, priceLabel } from '@/lib/format'

const SUGGESTIONS = ['Resident Evil', 'Pokémon', 'Mario', 'PS5', 'Switch', 'Zelda', 'Terror']
const MAX_RESULTS = 8

/**
 * Buscador global. Busca por nombre, plataforma y género (sin importar tildes).
 */
export default function SearchOverlay({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    setQ('')
    setActive(0)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = window.setTimeout(() => inputRef.current?.focus(), 80)
    return () => {
      document.body.style.overflow = prev
      window.clearTimeout(t)
    }
  }, [open])

  const results = useMemo(() => {
    const term = normalize(q)
    if (term.length < 2) return []
    const words = term.split(/\s+/).filter(Boolean)
    return products
      .map((p) => {
        const haystack = normalize(
          `${p.name} ${platformLabel(p.platform)} ${p.tags.join(' ')} ${genreLabel(p.genre)}`
        )
        if (!words.every((w) => haystack.includes(w))) return null
        // Prioriza coincidencias al inicio del nombre
        const score = normalize(p.name).startsWith(term) ? 0 : normalize(p.name).includes(term) ? 1 : 2
        return { p, score }
      })
      .filter((x): x is { p: (typeof products)[number]; score: number } => x !== null)
      .sort((a, b) => a.score - b.score || a.p.name.localeCompare(b.p.name))
      .slice(0, MAX_RESULTS)
      .map((x) => x.p)
  }, [q])

  useEffect(() => setActive(0), [q])

  if (!open) return null

  const goToCatalog = () => {
    onClose()
    navigate(`/catalogo?q=${encodeURIComponent(q.trim())}`)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') return onClose()
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[active]) {
        onClose()
        navigate(`/producto/${results[active].slug}`)
      } else if (q.trim().length >= 2) {
        goToCatalog()
      }
    }
  }

  return (
    <div className="fixed inset-0 z-[65]" role="dialog" aria-modal="true" aria-label="Buscar juegos">
      <button
        type="button"
        onClick={onClose}
        tabIndex={-1}
        aria-label="Cerrar buscador"
        className="absolute inset-0 h-full w-full animate-fade-in cursor-default bg-ink-900/85 backdrop-blur-sm"
      />

      <div className="relative mx-auto mt-[6vh] w-[min(680px,94vw)] animate-scale-in overflow-hidden rounded-2xl border border-white/12 bg-ink-800 shadow-2xl">
        <div className="flex items-center gap-3 border-b border-white/10 px-4">
          <Search className="h-5 w-5 shrink-0 text-gold-500" aria-hidden="true" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            placeholder="Busca por juego, plataforma o género…"
            aria-label="Buscar en el catálogo"
            className="h-14 w-full min-w-0 bg-transparent text-base text-white outline-none placeholder:text-white/35"
          />
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Cerrar buscador"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[62vh] overflow-y-auto overscroll-contain">
          {q.trim().length < 2 ? (
            <div className="p-4">
              <p className="mb-3 text-2xs font-bold uppercase tracking-widest text-white/40">
                Búsquedas frecuentes
              </p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setQ(s)}
                    className="rounded-full border border-white/12 bg-white/[.05] px-3 py-2 text-xs font-semibold text-white/75 transition-colors hover:border-gold-500/45 hover:text-white"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : results.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="font-display text-lg font-extrabold text-white">
                No encontramos ese juego.
              </p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-white/55">
                Revisa la escritura o vuelve a las categorías. Si lo buscas y no aparece,
                escríbenos: puede que lo tengamos o lo consigamos.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Link to="/catalogo" onClick={onClose} className="btn-secondary text-xs">
                  Ver todas las categorías
                </Link>
                <a
                  href={`https://wa.me/573508271637?text=${encodeURIComponent(
                    `Hola GOOD GAME 🎮, estoy buscando "${q.trim()}". ¿Lo tienen disponible?`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-wa text-xs"
                >
                  Preguntar por WhatsApp
                </a>
              </div>
            </div>
          ) : (
            <>
              <ul className="p-2">
                {results.map((p, i) => (
                  <li key={p.slug}>
                    <Link
                      to={`/producto/${p.slug}`}
                      onClick={onClose}
                      onMouseEnter={() => setActive(i)}
                      className={`flex items-center gap-3 rounded-xl p-2 transition-colors ${
                        i === active ? 'bg-white/[.09]' : 'hover:bg-white/[.06]'
                      }`}
                    >
                      <span className="block h-16 w-12 shrink-0 overflow-hidden rounded-md bg-ink-700">
                        <ProductImage src={p.images[0]} alt="" className="h-full w-full" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-white">
                          {p.name}
                        </span>
                        <span className="mt-1 flex items-center gap-2">
                          <PlatformBadge platform={p.platform} />
                          <span className="truncate text-2xs text-white/45">
                            {genreLabel(p.genre)}
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 text-2xs font-bold text-gold-500">
                        {priceLabel(p.price)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={goToCatalog}
                className="flex w-full items-center justify-center gap-2 border-t border-white/10 px-4 py-3 text-xs font-bold text-white/70 transition-colors hover:bg-white/[.06] hover:text-white"
              >
                Ver todos los resultados de “{q.trim()}”
                <CornerDownLeft className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

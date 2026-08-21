import { Heart, MessageCircle, Plus, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import ProductImage from '@/components/ui/ProductImage'
import { ConditionBadge, PlatformBadge, RegionBadge, StockBadge, isAvailable } from '@/components/ui/Badges'
import { genreLabel } from '@/data/taxonomy'
import { cop } from '@/lib/format'
import { productMessage } from '@/lib/whatsapp'
import { useStore } from '@/store/StoreContext'
import type { Product } from '@/types'

interface Props {
  product: Product
  priority?: boolean
  /** Se oculta en secciones que ya son de destacados (sería redundante). */
  showFeaturedBadge?: boolean
}

export default function ProductCard({
  product,
  priority = false,
  showFeaturedBadge = true,
}: Props) {
  const { addToCart, isFavorite, toggleFavorite } = useStore()
  const available = isAvailable(product)
  const fav = isFavorite(product.slug)
  const discount =
    product.price !== null && product.oldPrice !== null && product.oldPrice > product.price
      ? Math.round((1 - product.price / product.oldPrice) * 100)
      : 0

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-card border border-white/10 bg-ink-700/55 shadow-card transition-all duration-300 ease-out hover:-translate-y-1 hover:border-gold-500/35 hover:shadow-card-hover">
      {/* ── Portada ───────────────────────────────────────────────────────── */}
      <Link
        to={`/producto/${product.slug}`}
        className="relative block bg-gradient-to-b from-blue-900/45 via-ink-800 to-ink-800 focus-visible:outline-none"
        aria-label={`Ver ${product.name}`}
      >
        <span
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background:
              'radial-gradient(70% 55% at 50% 42%, rgba(255,240,0,.16), transparent 70%)',
          }}
          aria-hidden="true"
        />
        <span className="relative block aspect-[3/4] p-3.5">
          <ProductImage
            src={product.images[0]}
            alt={`Portada de ${product.name} para ${product.tags[0]}`}
            className="h-full w-full drop-shadow-[0_10px_20px_rgba(0,0,0,.55)] transition-transform duration-500 ease-out group-hover:scale-[1.045]"
            priority={priority}
            fallback={{ name: product.name, platform: product.platform }}
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 220px"
          />
        </span>

        {/* Badges superiores */}
        <span className="pointer-events-none absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
          <PlatformBadge platform={product.platform} />
          {discount > 0 && (
            <span className="chip border-alert-500/50 bg-alert-500 text-white">
              -{discount}%
            </span>
          )}
          {showFeaturedBadge && product.featured && discount === 0 && (
            <span className="chip border-gold-500/50 bg-gold-500 text-ink-900">Destacado</span>
          )}
        </span>

        {/* Estado agotado */}
        {!available && (
          <span className="absolute inset-0 grid place-items-center bg-ink-900/72 backdrop-blur-[1px]">
            <span className="rounded-lg border border-alert-500/60 bg-ink-900/85 px-3 py-1.5 font-display text-xs font-extrabold uppercase tracking-widest text-alert-400">
              Agotado
            </span>
          </span>
        )}

        {/* Llamado en hover (escritorio) */}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 hidden translate-y-2 justify-center pb-3 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 md:flex">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-500 px-3.5 py-1.5 text-2xs font-black uppercase tracking-wider text-ink-900 shadow-gold">
            Ver producto <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </span>
      </Link>

      {/* Favorito */}
      <button
        type="button"
        onClick={() => toggleFavorite(product)}
        aria-pressed={fav}
        aria-label={fav ? `Quitar ${product.name} de favoritos` : `Guardar ${product.name} en favoritos`}
        className={`absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full border backdrop-blur transition-all duration-200 before:absolute before:-inset-1.5 before:content-[''] ${
          fav
            ? 'border-alert-500/60 bg-alert-500/25 text-alert-400'
            : 'border-white/15 bg-ink-900/55 text-white/55 hover:border-white/35 hover:text-white'
        }`}
      >
        <Heart className={`h-4 w-4 ${fav ? 'fill-current' : ''}`} aria-hidden="true" />
      </button>

      {/* ── Información ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-2 p-3 pt-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <ConditionBadge condition={product.condition} />
          <RegionBadge region={product.region} />
        </div>

        <p className="text-2xs font-bold uppercase tracking-wider text-white/40">
          {genreLabel(product.genre)}
        </p>

        <h3 className="text-pretty text-[13.5px] font-bold leading-snug text-white sm:text-sm">
          <Link
            to={`/producto/${product.slug}`}
            className="line-clamp-2 transition-colors hover:text-gold-500"
          >
            {product.name}
          </Link>
        </h3>

        <div className="mt-auto space-y-2 pt-1">
          <StockBadge product={product} />

          <div className="flex items-end gap-2">
            {product.price === null ? (
              <p className="font-display text-sm font-extrabold leading-none text-gold-500">
                Consultar precio
              </p>
            ) : (
              <>
                <p className="tabular font-display text-lg font-black leading-none text-gold-500">
                  {cop(product.price)}
                </p>
                {discount > 0 && (
                  <p className="tabular text-xs leading-none text-white/35 line-through">
                    {cop(product.oldPrice as number)}
                  </p>
                )}
              </>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => addToCart(product)}
              disabled={!available}
              className="btn-primary h-11 min-h-0 flex-1 px-2 text-xs"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Agregar</span>
            </button>
            <a
              href={productMessage(product)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Preguntar por ${product.name} en WhatsApp`}
              className="btn-wa h-11 min-h-0 w-11 shrink-0 px-0"
            >
              <MessageCircle className="h-[18px] w-[18px]" aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>
    </article>
  )
}

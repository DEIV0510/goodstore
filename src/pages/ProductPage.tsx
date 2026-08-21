import {
  ChevronRight,
  Heart,
  Home,
  Info,
  MessageCircle,
  Minus,
  Plus,
  ShoppingCart,
  Truck,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import ProductCard from '@/components/catalog/ProductCard'
import ProductImage from '@/components/ui/ProductImage'
import { ConditionBadge, PlatformBadge, RegionBadge, StockBadge, isAvailable } from '@/components/ui/Badges'
import { products } from '@/data/products'
import { conditionLabel, genreLabel, platformLabel, regionLabel } from '@/data/taxonomy'
import { site } from '@/data/site'
import { cop } from '@/lib/format'
import { productMessage } from '@/lib/whatsapp'
import { useSeo } from '@/lib/seo'
import { useStore } from '@/store/StoreContext'

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>()
  const product = useMemo(() => products.find((p) => p.slug === slug), [slug])
  const [qty, setQty] = useState(1)
  const [activeImage, setActiveImage] = useState(0)
  const { addToCart, isFavorite, toggleFavorite, setCartOpen } = useStore()

  const related = useMemo(() => {
    if (!product) return []
    const sameGenre = products.filter(
      (p) => p.slug !== product.slug && p.platform === product.platform && p.genre === product.genre
    )
    const samePlatform = products.filter(
      (p) => p.slug !== product.slug && p.platform === product.platform && p.genre !== product.genre
    )
    return [...sameGenre, ...samePlatform].slice(0, 5)
  }, [product])

  useSeo({
    title: product
      ? `${product.name} — ${platformLabel(product.platform)} | GOOD GAME`
      : 'Producto no encontrado | GOOD GAME',
    description: product
      ? `${product.description || `${product.name} para ${platformLabel(product.platform)}, ${product.condition}.`} Disponible en GOOD GAME con envíos a Medellín y toda Colombia.`
      : 'Este producto no está disponible en GOOD GAME.',
    path: `/producto/${slug ?? ''}`,
    image: product?.images[0],
    jsonLd: product
      ? {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.name,
          description:
            product.description ||
            `${product.name} para ${platformLabel(product.platform)} en estado ${product.condition}.`,
          ...(product.images[0] ? { image: `${site.url}${product.images[0]}` } : {}),
          category: platformLabel(product.platform),
          brand: { '@type': 'Brand', name: platformLabel(product.platform) },
          offers: {
            '@type': 'Offer',
            url: `${site.url}/producto/${product.slug}`,
            priceCurrency: 'COP',
            ...(product.price !== null ? { price: product.price } : {}),
            availability: isAvailable(product)
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
            seller: { '@type': 'Organization', name: site.name },
          },
        }
      : undefined,
  })

  if (!product) return <Navigate to="/404" replace />

  const available = isAvailable(product)
  const fav = isFavorite(product.slug)
  const discount =
    product.price !== null && product.oldPrice !== null && product.oldPrice > product.price
      ? Math.round((1 - product.price / product.oldPrice) * 100)
      : 0

  return (
    <article className="pb-8">
      {/* Ruta */}
      <div className="border-b border-white/[.08] bg-ink-800/40">
        <div className="gg-container py-3.5">
          <nav aria-label="Ruta de navegación">
            <ol className="flex flex-wrap items-center gap-1.5 text-2xs font-semibold text-white/50">
              <li>
                <Link to="/" className="inline-flex items-center gap-1 hover:text-gold-500">
                  <Home className="h-3.5 w-3.5" aria-hidden="true" />
                  Inicio
                </Link>
              </li>
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
              <li>
                <Link to="/catalogo" className="hover:text-gold-500">
                  Catálogo
                </Link>
              </li>
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
              <li>
                <Link
                  to={`/catalogo?plataforma=${product.platform}`}
                  className="hover:text-gold-500"
                >
                  {platformLabel(product.platform)}
                </Link>
              </li>
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
              <li aria-current="page" className="max-w-[46vw] truncate text-white/80">
                {product.name}
              </li>
            </ol>
          </nav>
        </div>
      </div>

      <div className="gg-container pt-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,.95fr),minmax(0,1.05fr)] lg:gap-12">
          {/* ── Galería ─────────────────────────────────────────────────── */}
          <div>
            <div className="relative overflow-hidden rounded-xl2 border border-white/10 bg-[radial-gradient(80%_65%_at_50%_35%,#0C1287_0%,#070A78_45%,#070C42_100%)] p-6 sm:p-10">
              <div
                className="pointer-events-none absolute inset-0 bg-tech opacity-30"
                aria-hidden="true"
              />
              <div className="relative mx-auto w-full max-w-[330px]">
                <ProductImage
                  src={product.images[activeImage]}
                  alt={`Portada de ${product.name} para ${platformLabel(product.platform)}`}
                  className="aspect-[3/4] w-full overflow-hidden rounded-lg drop-shadow-[0_24px_44px_rgba(0,0,0,.75)]"
                  priority
                  fallback={{ name: product.name, platform: product.platform }}
                />
              </div>
              {!available && (
                <div className="absolute inset-0 grid place-items-center bg-ink-900/70 backdrop-blur-[1px]">
                  <span className="rounded-lg border border-alert-500/60 bg-ink-900/85 px-4 py-2 font-display text-sm font-black uppercase tracking-widest text-alert-400">
                    Agotado
                  </span>
                </div>
              )}
            </div>

            {product.images.length > 1 && (
              <ul className="mt-3 flex gap-2.5">
                {product.images.map((src, i) => (
                  <li key={src}>
                    <button
                      type="button"
                      onClick={() => setActiveImage(i)}
                      aria-label={`Ver imagen ${i + 1} de ${product.name}`}
                      aria-pressed={activeImage === i}
                      className={`block h-24 w-[68px] overflow-hidden rounded-lg border bg-ink-700 transition-colors ${
                        activeImage === i
                          ? 'border-gold-500'
                          : 'border-white/12 hover:border-white/35'
                      }`}
                    >
                      <ProductImage src={src} alt="" className="h-full w-full" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-3 text-2xs leading-relaxed text-white/35">
              {product.images.length > 0
                ? 'Fotografía tomada de nuestro propio inventario. El estado exacto de la copia se confirma por WhatsApp antes de la entrega.'
                : 'Todavía no tenemos fotografía de esta copia. Escríbenos y te enviamos fotos reales antes de que decidas.'}
            </p>
          </div>

          {/* ── Información y compra ────────────────────────────────────── */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <PlatformBadge platform={product.platform} />
              <ConditionBadge condition={product.condition} />
              <RegionBadge region={product.region} />
              {product.featured && (
                <span className="chip border-gold-500/50 bg-gold-500 text-ink-900">Destacado</span>
              )}
            </div>

            <h1
              className="mt-4 text-balance font-display text-3xl font-black leading-[1.08] tracking-tight sm:text-4xl"
              style={{ fontStretch: '108%' }}
            >
              {product.name}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/55">
              <StockBadge product={product} />
              <span className="text-white/25" aria-hidden="true">
                ·
              </span>
              <Link
                to={`/catalogo?genero=${product.genre}`}
                className="font-semibold text-white/60 underline-offset-4 hover:text-gold-500 hover:underline"
              >
                {genreLabel(product.genre)}
              </Link>
            </div>

            {product.description ? (
              <p className="mt-5 text-pretty text-[15px] leading-relaxed text-white/70">
                {product.description}
              </p>
            ) : (
              <p className="mt-5 text-pretty text-[15px] leading-relaxed text-white/50">
                Todavía no tenemos una descripción de este título. Escríbenos y te contamos
                de qué se trata y en qué estado está la copia.
              </p>
            )}

            {product.note && (
              <p className="mt-4 flex gap-2.5 rounded-lg border border-gold-500/25 bg-gold-500/[.07] px-3.5 py-3 text-[13px] leading-relaxed text-gold-300">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                {product.note}
              </p>
            )}

            {/* Precio */}
            <div className="mt-7 rounded-xl2 border border-white/10 bg-ink-700/55 p-5">
              {product.price === null ? (
                <>
                  <p className="font-display text-2xl font-black text-gold-500 sm:text-3xl">
                    Consultar precio
                  </p>
                  <p className="mt-2 text-[13px] leading-relaxed text-white/55">
                    El precio depende del estado y la disponibilidad de la copia. Escríbenos y
                    te lo confirmamos al momento.
                  </p>
                </>
              ) : (
                <div className="flex flex-wrap items-end gap-3">
                  <p className="tabular font-display text-3xl font-black text-gold-500 sm:text-4xl">
                    {cop(product.price)}
                  </p>
                  {discount > 0 && (
                    <>
                      <p className="tabular text-base text-white/35 line-through">
                        {cop(product.oldPrice as number)}
                      </p>
                      <span className="chip border-alert-500/50 bg-alert-500 text-white">
                        -{discount}%
                      </span>
                    </>
                  )}
                </div>
              )}

              {/* Cantidad + acciones */}
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex h-12 items-center rounded-xl border border-white/12 bg-white/[.04]">
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    disabled={qty <= 1}
                    className="grid h-full w-11 place-items-center rounded-l-xl text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-35"
                    aria-label="Disminuir cantidad"
                  >
                    <Minus className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <span
                    className="tabular w-10 text-center text-sm font-bold text-white"
                    aria-live="polite"
                    aria-label={`Cantidad: ${qty}`}
                  >
                    {qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.min(99, q + 1))}
                    className="grid h-full w-11 place-items-center rounded-r-xl text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="Aumentar cantidad"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                <button
                  type="button"
                  disabled={!available}
                  onClick={() => {
                    addToCart(product, qty)
                    setCartOpen(true)
                  }}
                  className="btn-primary h-12 min-h-0 flex-1 text-sm"
                >
                  <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                  Agregar al carrito
                </button>

                <button
                  type="button"
                  onClick={() => toggleFavorite(product)}
                  aria-pressed={fav}
                  aria-label={fav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
                  className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl border transition-colors ${
                    fav
                      ? 'border-alert-500/60 bg-alert-500/20 text-alert-400'
                      : 'border-white/15 bg-white/[.05] text-white/60 hover:border-white/35 hover:text-white'
                  }`}
                >
                  <Heart className={`h-5 w-5 ${fav ? 'fill-current' : ''}`} aria-hidden="true" />
                </button>
              </div>

              <a
                href={productMessage(product)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-wa mt-3 h-12 w-full min-h-0 text-sm"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                {available ? 'Quiero este juego (WhatsApp)' : 'Preguntar cuándo vuelve'}
              </a>
            </div>

            {/* Información del producto */}
            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl2 border border-white/10 bg-ink-700/35 p-5 text-[13px]">
              <div>
                <dt className="text-2xs uppercase tracking-wider text-white/40">Plataforma</dt>
                <dd className="mt-0.5 font-semibold text-white/85">
                  {platformLabel(product.platform)}
                </dd>
              </div>
              <div>
                <dt className="text-2xs uppercase tracking-wider text-white/40">Género</dt>
                <dd className="mt-0.5 font-semibold text-white/85">{genreLabel(product.genre)}</dd>
              </div>
              <div>
                <dt className="text-2xs uppercase tracking-wider text-white/40">Formato</dt>
                <dd className="mt-0.5 font-semibold text-white/85">Físico</dd>
              </div>
              <div>
                <dt className="text-2xs uppercase tracking-wider text-white/40">Región</dt>
                <dd className="mt-0.5 font-semibold text-white/85">{regionLabel(product.region)}</dd>
              </div>
              <div>
                <dt className="text-2xs uppercase tracking-wider text-white/40">Estado</dt>
                <dd className="mt-0.5 font-semibold text-white/85">
                  {conditionLabel(product.condition)}
                </dd>
              </div>
              <div>
                <dt className="text-2xs uppercase tracking-wider text-white/40">Referencia</dt>
                <dd className="mt-0.5 font-mono text-xs font-semibold uppercase text-white/70">
                  {product.id}
                </dd>
              </div>
              <div>
                <dt className="text-2xs uppercase tracking-wider text-white/40">Ubicación</dt>
                <dd className="mt-0.5 font-semibold text-white/85">{site.city}, {site.region}</dd>
              </div>
            </dl>

            <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-2xs text-white/55">
              {[
                { icon: Truck, text: 'Envíos a toda Colombia' },
                { icon: RefreshCw, text: 'Recibimos usados como parte de pago' },
                { icon: ShieldCheck, text: 'Confirmamos todo antes de enviar' },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-gold-500" aria-hidden="true" />
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Relacionados */}
        {related.length > 0 && (
          <section className="mt-12" aria-labelledby="relacionados-title">
            <h2
              id="relacionados-title"
              className="font-display text-xl font-black tracking-tight sm:text-2xl"
            >
              También te puede interesar
            </h2>
            <ul className="mt-6 grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
              {related.map((p) => (
                <li key={p.slug}>
                  <ProductCard product={p} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </article>
  )
}

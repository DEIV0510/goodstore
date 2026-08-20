import { ArrowRight, MessageCircle, Truck, Gamepad2, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import ProductImage from '@/components/ui/ProductImage'
import { MESSAGES, site, waLink } from '@/data/site'
import { products } from '@/data/products'

/** Portadas reales usadas en la composición del hero. */
const HERO_SLUGS = [
  'the-legend-of-zelda-breath-of-the-wild-switch',
  'ghost-of-tsushima-ps4',
  'elden-ring-ps5',
  'god-of-war-ragnarok-ps5',
  'pokemon-scarlet-switch',
]

const bySlug = new Map(products.map((p) => [p.slug, p]))
const covers = HERO_SLUGS.map((s) => bySlug.get(s)).filter(Boolean) as typeof products

/** Transformaciones del abanico de portadas (escritorio). */
const FAN = [
  { rotate: -14, x: -196, y: 34, z: 1, scale: 0.84 },
  { rotate: -7, x: -100, y: 8, z: 2, scale: 0.92 },
  { rotate: 0, x: 0, y: -12, z: 3, scale: 1 },
  { rotate: 7, x: 100, y: 8, z: 2, scale: 0.92 },
  { rotate: 14, x: 196, y: 34, z: 1, scale: 0.84 },
]

export default function Hero() {
  return (
    <section className="relative overflow-hidden" aria-labelledby="hero-title">
      {/* Fondo */}
      <div className="absolute inset-0 z-0" aria-hidden="true">
        <div className="absolute inset-0 bg-[linear-gradient(168deg,#151DAE_0%,#111899_20%,#0C1287_44%,#080C60_70%,#070C42_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(70%_55%_at_72%_38%,rgba(255,240,0,.10),transparent_70%)]" />
        <div className="absolute inset-0 bg-tech opacity-[.6] [mask-image:radial-gradient(85%_75%_at_50%_35%,#000_15%,transparent_85%)]" />
        <div className="absolute -left-24 top-6 h-72 w-72 rounded-full bg-blue-400/30 blur-[110px]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-ink-900" />
      </div>

      <div className="gg-container relative z-10 pb-16 pt-10 sm:pt-14 lg:pb-24 lg:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr),minmax(0,1.02fr)] lg:gap-8">
          {/* ── Copy ────────────────────────────────────────────────────── */}
          <div className="animate-fade-up text-center lg:text-left">
            <p className="eyebrow justify-center lg:justify-start">
              <span className="h-1.5 w-1.5 rounded-full bg-gold-500" aria-hidden="true" />
              {site.name} · {site.tagline}
            </p>

            <h1
              id="hero-title"
              className="mt-4 text-balance font-display text-[2.5rem] font-black leading-[1.02] tracking-tight text-white sm:text-6xl lg:text-[4.1rem]"
              style={{ fontStretch: '112%' }}
            >
              Tu próximo juego <span className="text-gold-500">empieza aquí.</span>
            </h1>

            <p className="mx-auto mt-5 max-w-lg text-pretty text-base leading-relaxed text-white/70 sm:text-lg lg:mx-0">
              Videojuegos, consolas y accesorios para llevar tu experiencia gaming al
              siguiente nivel.
            </p>

            <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center lg:justify-start">
              <Link to="/catalogo" className="btn-primary h-13 px-7 text-sm sm:text-[15px]">
                Ver catálogo
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a
                href={waLink(MESSAGES.catalog)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary h-13 px-7 text-sm sm:text-[15px]"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Comprar por WhatsApp
              </a>
            </div>

            <ul className="mx-auto mt-9 flex max-w-lg flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs font-semibold text-white/55 lg:mx-0 lg:justify-start">
              <li className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-gold-500" aria-hidden="true" />
                Envíos a toda Colombia
              </li>
              <li className="flex items-center gap-2">
                <Gamepad2 className="h-4 w-4 text-gold-500" aria-hidden="true" />
                PS4 · PS5 · Switch
              </li>
              <li className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-gold-500" aria-hidden="true" />
                Nuevos y usados
              </li>
            </ul>
          </div>

          {/* ── Composición de portadas ─────────────────────────────────── */}
          <div className="relative">
            {/* Escritorio: abanico con profundidad */}
            <div
              className="relative mx-auto hidden h-[420px] w-full max-w-[620px] items-center justify-center lg:flex"
              style={{ perspective: '1400px' }}
            >
              <div
                className="pointer-events-none absolute inset-x-6 bottom-10 h-40 rounded-[50%] bg-ink-900/70 blur-3xl"
                aria-hidden="true"
              />
              {covers.map((p, i) => {
                const f = FAN[i]
                return (
                  <Link
                    key={p.slug}
                    to={`/producto/${p.slug}`}
                    className="group absolute block h-[300px] w-[228px] rounded-xl transition-transform duration-500 ease-out hover:!translate-y-[-22px] hover:!scale-105"
                    style={{
                      transform: `translate3d(${f.x}px, ${f.y}px, 0) rotate(${f.rotate}deg) scale(${f.scale})`,
                      zIndex: f.z,
                    }}
                    aria-label={`Ver ${p.name}`}
                  >
                    <span className="relative block h-full w-full overflow-hidden rounded-xl border border-white/12 bg-ink-800 shadow-[0_24px_48px_-18px_rgba(0,0,0,.95)]">
                      <ProductImage
                        src={p.images[0]}
                        alt={`Portada de ${p.name}`}
                        className="h-full w-full"
                        priority={i === 2}
                      />
                      <span
                        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-900/55 via-transparent to-white/[.06]"
                        aria-hidden="true"
                      />
                      <span className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-full bg-ink-900/92 px-3 py-2 text-center text-2xs font-bold text-gold-500 transition-transform duration-300 group-hover:translate-y-0">
                        Ver producto
                      </span>
                    </span>
                  </Link>
                )
              })}
            </div>

            {/* Móvil y tablet: trío compacto */}
            <div className="flex items-end justify-center gap-3 lg:hidden">
              {covers.slice(1, 4).map((p, i) => (
                <Link
                  key={p.slug}
                  to={`/producto/${p.slug}`}
                  className={`block overflow-hidden rounded-xl border border-white/12 bg-ink-800 shadow-[0_18px_36px_-16px_rgba(0,0,0,.9)] transition-transform duration-300 active:scale-95 ${
                    i === 1 ? 'w-[38%] max-w-[190px]' : 'w-[29%] max-w-[150px] opacity-90'
                  }`}
                  style={{ transform: i === 1 ? 'none' : `rotate(${i === 0 ? -6 : 6}deg)` }}
                  aria-label={`Ver ${p.name}`}
                >
                  <ProductImage
                    src={p.images[0]}
                    alt={`Portada de ${p.name}`}
                    className="aspect-[3/4] w-full"
                    priority={i === 1}
                  />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

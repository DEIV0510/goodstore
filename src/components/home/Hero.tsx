import type { CSSProperties } from 'react'
import { ArrowRight, MessageCircle, Truck, Gamepad2, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import ProductImage from '@/components/ui/ProductImage'
import { MESSAGES, waLink } from '@/data/site'
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

/**
 * Abanico de portadas en escritorio.
 *
 * `i` es la posición respecto al centro (−2 … 2). La separación la pone la
 * hoja de estilos en `--gg-step`, medida en vw: así el abanico se cierra solo
 * en portátiles de 1280–1366 px y no se monta sobre el titular.
 */
const FAN = [
  { i: -2, rotate: -13, ry: 20, y: 38, z: 1, scale: 0.85 },
  { i: -1, rotate: -6.5, ry: 11, y: 9, z: 2, scale: 0.92 },
  { i: 0, rotate: 0, ry: 0, y: -14, z: 3, scale: 1 },
  { i: 1, rotate: 6.5, ry: -11, y: 9, z: 2, scale: 0.92 },
  { i: 2, rotate: 13, ry: -20, y: 38, z: 1, scale: 0.85 },
]

/** Estantería compacta en móvil: es lo primero que se ve al abrir la web. */
// Los anchos suman 92 % + separaciones: dejan margen para que la rotación
// no saque las esquinas fuera del contenedor.
const SHELF = [
  { rotate: -9, y: 16, z: 1, w: 'w-[16%]' },
  { rotate: -4, y: 6, z: 2, w: 'w-[19%]' },
  { rotate: 0, y: 0, z: 3, w: 'w-[22%]' },
  { rotate: 4, y: 6, z: 2, w: 'w-[19%]' },
  { rotate: 9, y: 16, z: 1, w: 'w-[16%]' },
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

      <div className="gg-container relative z-10 pb-12 pt-5 sm:pt-10 lg:pb-24 lg:pt-20">
        <div className="grid items-center gap-7 lg:grid-cols-[minmax(0,1fr),minmax(0,1.02fr)] lg:gap-8">
          {/* ── Portadas ────────────────────────────────────────────────────
              En móvil van PRIMERO: lo primero que se ve son los juegos.     */}
          <div className="relative order-1 lg:order-2">
            {/* Escritorio: abanico con profundidad */}
            <div
              className="gg-deck relative mx-auto hidden h-[clamp(340px,31vw,430px)] w-full max-w-[620px] items-center justify-center lg:flex"
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
                    className="gg-fan group absolute block aspect-[3/4] w-[clamp(168px,15.5vw,228px)] rounded-xl"
                    style={
                      {
                        '--gg-i': f.i,
                        '--gg-y': `${f.y}px`,
                        '--gg-rot': `${f.rotate}deg`,
                        '--gg-ry': `${f.ry}deg`,
                        '--gg-scale': f.scale,
                        '--gg-z': f.z,
                      } as CSSProperties
                    }
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
                      <span className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-full bg-ink-900/92 px-2.5 py-2 text-center transition-transform duration-300 group-hover:translate-y-0">
                        <span className="line-clamp-1 text-2xs font-bold text-white">
                          {p.name}
                        </span>
                        <span className="mt-0.5 block text-2xs font-black uppercase tracking-wider text-gold-500">
                          Ver producto
                        </span>
                      </span>
                    </span>
                  </Link>
                )
              })}
            </div>

            {/* Móvil y tablet: estantería con 5 portadas reales */}
            <div className="lg:hidden">
              <div className="flex items-end justify-center gap-[1.5%]">
                {covers.map((p, i) => {
                  const s = SHELF[i]
                  return (
                    <Link
                      key={p.slug}
                      to={`/producto/${p.slug}`}
                      className={`block overflow-hidden rounded-lg border border-white/12 bg-ink-800 shadow-[0_16px_32px_-14px_rgba(0,0,0,.9)] transition-transform duration-300 active:scale-95 ${s.w}`}
                      style={{
                        transform: `translateY(${s.y}px) rotate(${s.rotate}deg)`,
                        zIndex: s.z,
                      }}
                      aria-label={`Ver ${p.name}`}
                    >
                      <ProductImage
                        src={p.images[0]}
                        alt={`Portada de ${p.name}`}
                        className="aspect-[3/4] w-full"
                        priority={i === 2}
                      />
                    </Link>
                  )
                })}
              </div>

              <Link
                to="/catalogo"
                className="mx-auto mt-7 flex w-fit items-center gap-2 rounded-full border border-gold-500/35 bg-gold-500/10 px-3.5 py-2 text-2xs font-bold text-gold-500 transition-colors active:bg-gold-500/20"
              >
                {products.length} juegos disponibles
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>

          {/* ── Texto y llamados a la acción ───────────────────────────────── */}
          <div className="order-2 animate-fade-up text-center lg:order-1 lg:text-left">
            <h1
              id="hero-title"
              className="text-balance font-display text-[2.1rem] font-black leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-[4.1rem]"
              style={{ fontStretch: '112%' }}
            >
              Tu próximo juego <span className="text-gold-500">empieza aquí.</span>
            </h1>

            <p className="mx-auto mt-3.5 max-w-lg text-pretty text-[15px] leading-relaxed text-white/70 sm:text-lg lg:mx-0 lg:mt-5">
              Videojuegos, consolas y accesorios para llevar tu experiencia gaming al
              siguiente nivel.
            </p>

            <div className="mt-6 flex flex-col items-stretch gap-2.5 sm:flex-row sm:items-center sm:justify-center lg:mt-8 lg:justify-start">
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

            <ul className="mx-auto mt-6 flex max-w-lg flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-semibold text-white/55 lg:mx-0 lg:mt-9 lg:justify-start">
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
        </div>
      </div>
    </section>
  )
}

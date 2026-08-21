import { ArrowRight, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import ProductImage from '@/components/ui/ProductImage'

const COVERS = [
  '/games/the-last-of-us-remastered-ps4.webp',
  '/games/god-of-war-3-ps4.webp',
  '/games/resident-evil-4-version-clasica-ps4.webp',
  '/games/rayman-ps4.webp',
]

export default function UsedBanner() {
  return (
    <section className="gg-container py-10 sm:py-12" aria-labelledby="usados-banner-title">
      <div className="relative overflow-hidden rounded-xl2 border border-white/12 bg-[linear-gradient(115deg,#0C1287_0%,#070A78_45%,#070C42_100%)] shadow-card-hover">
        <div
          className="pointer-events-none absolute inset-0 bg-tech opacity-40"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-gold-500/12 blur-[90px]"
          aria-hidden="true"
        />

        <div className="relative grid items-center gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr),minmax(0,.85fr)] lg:p-10">
          <div>
            <p className="eyebrow">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Videojuegos usados
            </p>
            <h2
              id="usados-banner-title"
              className="mt-3 text-balance font-display text-2xl font-black leading-tight tracking-tight sm:text-3xl lg:text-[2.35rem]"
              style={{ fontStretch: '110%' }}
            >
              Dale una segunda vida a tus juegos
            </h2>
            <p className="mt-4 max-w-xl text-pretty text-sm leading-relaxed text-white/70 sm:text-base">
              Compramos, vendemos y recibimos videojuegos usados como parte de pago cuando
              aplique. Cuéntanos qué tienes.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link to="/usados" className="btn-primary h-13 px-6 text-sm">
                Quiero vender / entregar mi juego
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link to="/catalogo" className="btn-secondary h-13 px-6 text-sm">
                Ver juegos disponibles
              </Link>
            </div>
          </div>

          <div className="flex items-end justify-center gap-2 sm:gap-3 lg:justify-end">
            {COVERS.map((src, i) => (
              <span
                key={src}
                className="block w-[22%] max-w-[128px] overflow-hidden rounded-lg border border-white/12 shadow-[0_18px_34px_-16px_rgba(0,0,0,.95)] transition-transform duration-500 hover:-translate-y-2 sm:w-[23%]"
                style={{ transform: `translateY(${[14, 0, 8, 22][i]}px) rotate(${[-6, -2, 3, 8][i]}deg)` }}
              >
                <ProductImage src={src} alt="" className="aspect-[3/4] w-full" />
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

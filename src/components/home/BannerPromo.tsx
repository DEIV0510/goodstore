import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCatalogo } from '@/hooks/useCatalogo'

// ─────────────────────────────────────────────────────────────────────────────
// Franja promocional de la portada.
//
// Solo existe si el negocio crea un banner desde /admin/banners y lo activa
// dentro de su ventana de fechas. Si no hay ninguno, la portada simplemente no
// muestra esta franja: no se inventa una promoción de relleno.
// ─────────────────────────────────────────────────────────────────────────────

export default function BannerPromo() {
  const { banners } = useCatalogo()

  // El servicio ya devuelve solo los activos y vigentes, ordenados. Se muestra
  // el primero: dos franjas seguidas en la portada compiten entre sí.
  const banner = banners[0]
  if (!banner) return null

  const esExterno = /^https?:\/\//.test(banner.ctaHref)

  const contenido = (
    <>
      {banner.imageUrl && (
        <img
          src={banner.imageUrl}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover opacity-45"
          aria-hidden="true"
        />
      )}
      <span
        className="absolute inset-0 bg-[linear-gradient(100deg,#070A78_10%,rgba(7,10,120,.78)_52%,rgba(7,10,120,.35)_100%)]"
        aria-hidden="true"
      />
      <span
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_120%_at_8%_0%,rgba(255,240,0,.16),transparent_62%)]"
        aria-hidden="true"
      />

      <span className="relative flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <span className="min-w-0">
          <span className="block text-balance font-display text-xl font-black leading-tight tracking-tight text-white sm:text-2xl">
            {banner.title}
          </span>
          {banner.subtitle && (
            <span className="mt-1.5 block text-pretty text-sm leading-relaxed text-white/70">
              {banner.subtitle}
            </span>
          )}
        </span>

        {banner.ctaLabel && (
          <span className="btn-primary h-12 shrink-0 px-6 text-sm">
            {banner.ctaLabel}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </span>
    </>
  )

  const clases =
    'group relative block overflow-hidden rounded-card border border-white/12 shadow-card transition-all duration-300 hover:border-gold-500/35 hover:shadow-card-hover'

  return (
    <section className="gg-container py-4 sm:py-6" aria-label={banner.title}>
      {esExterno ? (
        <a href={banner.ctaHref} target="_blank" rel="noopener noreferrer" className={clases}>
          {contenido}
        </a>
      ) : (
        <Link to={banner.ctaHref} className={clases}>
          {contenido}
        </Link>
      )}
    </section>
  )
}

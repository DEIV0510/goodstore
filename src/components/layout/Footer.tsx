import { MapPin, MessageCircle, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'
import Logo from '@/components/brand/Logo'
import { MESSAGES, site, waLink } from '@/data/site'

const TIENDA = [
  { label: 'PlayStation 5', to: '/catalogo?plataforma=ps5' },
  { label: 'PlayStation 4', to: '/catalogo?plataforma=ps4' },
  { label: 'Nintendo Switch', to: '/catalogo?plataforma=switch' },
  { label: 'Todos los videojuegos', to: '/catalogo' },
  { label: 'Juegos usados', to: '/usados' },
  { label: 'Consolas', to: '/catalogo?categoria=consolas' },
  { label: 'Controles y accesorios', to: '/catalogo?categoria=accesorios' },
]

const AYUDA = [
  { label: 'Preguntas frecuentes', to: '/#preguntas' },
  { label: 'Envíos', to: '/#preguntas' },
  { label: 'Venta de usados', to: '/usados' },
  { label: 'Favoritos', to: '/favoritos' },
]

export default function Footer() {
  return (
    <footer className="relative mt-20 border-t border-white/10 bg-ink-800/60">
      <div
        className="pointer-events-none absolute inset-0 bg-tech opacity-40"
        aria-hidden="true"
      />

      <div className="gg-container relative py-12 lg:py-16">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          {/* Marca */}
          <div className="lg:col-span-4">
            <Logo size="lg" />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/60">
              Videojuegos, consolas y accesorios para gamers. Encuentra tu próximo título
              para PlayStation y Nintendo Switch.
            </p>
            <a
              href={waLink(MESSAGES.general)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-wa mt-6"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Escríbenos por WhatsApp
            </a>
          </div>

          {/* Tienda */}
          <nav aria-labelledby="footer-tienda" className="lg:col-span-3">
            <h2
              id="footer-tienda"
              className="font-display text-xs font-extrabold uppercase tracking-[.22em] text-gold-500"
            >
              Tienda
            </h2>
            <ul className="mt-2 -space-y-1">
              {TIENDA.map((l) => (
                <li key={l.label}>
                  <Link
                    to={l.to}
                    className="inline-block py-3 text-sm leading-tight text-white/65 transition-colors hover:text-gold-500"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Ayuda */}
          <nav aria-labelledby="footer-ayuda" className="lg:col-span-2">
            <h2
              id="footer-ayuda"
              className="font-display text-xs font-extrabold uppercase tracking-[.22em] text-gold-500"
            >
              Ayuda
            </h2>
            <ul className="mt-2 -space-y-1">
              {AYUDA.map((l) => (
                <li key={l.label}>
                  <Link
                    to={l.to}
                    className="inline-block py-3 text-sm leading-tight text-white/65 transition-colors hover:text-gold-500"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href={waLink(MESSAGES.general)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block py-3 text-sm leading-tight text-white/65 transition-colors hover:text-gold-500"
                >
                  Contacto
                </a>
              </li>
            </ul>
          </nav>

          {/* Contacto */}
          <div className="lg:col-span-3">
            <h2 className="font-display text-xs font-extrabold uppercase tracking-[.22em] text-gold-500">
              Contacto
            </h2>
            <ul className="mt-4 space-y-4 text-sm">
              <li>
                <a
                  href={waLink(MESSAGES.general)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-2.5"
                >
                  <MessageCircle
                    className="mt-0.5 h-4 w-4 shrink-0 text-[#25D366]"
                    aria-hidden="true"
                  />
                  <span>
                    <span className="block text-2xs uppercase tracking-wider text-white/40">
                      WhatsApp
                    </span>
                    <span className="font-display text-base font-extrabold text-white transition-colors group-hover:text-gold-500">
                      {site.whatsappDisplay}
                    </span>
                  </span>
                </a>
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-white/40" aria-hidden="true" />
                <span>
                  <span className="block text-2xs uppercase tracking-wider text-white/40">
                    Ubicación
                  </span>
                  <span className="text-white/70">{site.locationLabel}</span>
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Truck className="mt-0.5 h-4 w-4 shrink-0 text-white/40" aria-hidden="true" />
                <span>
                  <span className="block text-2xs uppercase tracking-wider text-white/40">
                    Envíos
                  </span>
                  <span className="text-white/70">{site.shippingLabel}</span>
                </span>
              </li>
            </ul>

            {site.socials.length > 0 ? (
              <div className="mt-5 flex gap-2">
                {site.socials.map((s) => (
                  <a
                    key={s.name}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-white/12 px-3 py-2 text-xs font-semibold text-white/70 transition-colors hover:border-gold-500/45 hover:text-white"
                  >
                    {s.name}
                  </a>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-2xs leading-relaxed text-white/35">
                Redes sociales próximamente. Por ahora, la atención es directa por WhatsApp.
              </p>
            )}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center gap-3 border-t border-white/10 pt-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="font-display text-xs font-bold uppercase tracking-[.2em] text-white/45">
            {site.name} — {site.tagline}
          </p>
          <p className="text-2xs text-white/35">
            © {new Date().getFullYear()} {site.name}. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  )
}

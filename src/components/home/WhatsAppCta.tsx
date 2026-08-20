import { MessageCircle, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { MESSAGES, site, waLink } from '@/data/site'

export default function WhatsAppCta() {
  return (
    <section className="gg-container py-10 sm:py-12" aria-labelledby="cta-title">
      <div className="relative overflow-hidden rounded-xl2 border border-gold-500/25 bg-[linear-gradient(135deg,#070A78_0%,#0C1287_38%,#070C42_100%)] p-7 text-center shadow-card-hover sm:p-10">
        <div
          className="pointer-events-none absolute inset-0 bg-tech opacity-35"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-56 w-[520px] -translate-x-1/2 rounded-full bg-gold-500/12 blur-[100px]"
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-2xl">
          <p className="eyebrow justify-center">¿Buscas un título específico?</p>
          <h2
            id="cta-title"
            className="mt-3 text-balance font-display text-2xl font-black leading-tight tracking-tight sm:text-4xl"
            style={{ fontStretch: '110%' }}
          >
            Escríbenos y te decimos si lo tenemos
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-sm leading-relaxed text-white/70 sm:text-base">
            Te confirmamos disponibilidad, precio y envío al momento.
          </p>

          <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row">
            <a
              href={waLink(MESSAGES.general)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary h-13 px-7 text-sm"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Consultar por WhatsApp
            </a>
            <Link to="/catalogo" className="btn-secondary h-13 px-7 text-sm">
              <Search className="h-4 w-4" aria-hidden="true" />
              Buscar en el catálogo
            </Link>
          </div>

          <p className="mt-6 font-display text-sm font-bold tracking-wide text-white/50">
            {site.whatsappDisplay} · {site.locationLabel}
          </p>
        </div>
      </div>
    </section>
  )
}

import { ArrowUpRight, Clock3 } from 'lucide-react'
import { Link } from 'react-router-dom'
import ProductImage from '@/components/ui/ProductImage'
import SectionHeading from './SectionHeading'
import { categories } from '@/data/categories'

export default function Categories() {
  return (
    <section className="gg-container py-10 sm:py-12" aria-labelledby="categorias-title">
      <SectionHeading
        id="categorias-title"
        eyebrow="Categorías"
        title="Explora por categoría"
        linkTo="/catalogo"
        linkLabel="Ver catálogo completo"
      />

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => (
          <li key={c.id}>
            <Link
              to={c.href}
              className="group relative flex h-full min-h-[168px] flex-col justify-between overflow-hidden rounded-card border border-white/10 bg-ink-700/55 p-5 shadow-card transition-all duration-300 ease-out hover:-translate-y-1 hover:border-gold-500/35 hover:shadow-card-hover"
            >
              {/* Brillo de marca */}
              <span
                className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                style={{
                  background:
                    'radial-gradient(90% 80% at 15% 0%, rgba(255,240,0,.14), transparent 62%)',
                }}
                aria-hidden="true"
              />

              {/* Portadas reales apiladas */}
              {c.covers.length > 0 ? (
                <span
                  className="pointer-events-none absolute -right-2 bottom-0 top-0 flex w-[46%] items-center justify-end"
                  aria-hidden="true"
                >
                  {c.covers.map((src, i) => (
                    <span
                      key={src}
                      className="absolute block w-[54%] overflow-hidden rounded-lg border border-white/12 shadow-[0_16px_30px_-14px_rgba(0,0,0,.95)] transition-transform duration-500 ease-out"
                      style={{
                        right: `${8 + i * 20}%`,
                        zIndex: 3 - i,
                        transform: `rotate(${(i - 1) * 6}deg) translateY(${i * 5}px) scale(${1 - i * 0.06})`,
                        opacity: 1 - i * 0.18,
                      }}
                    >
                      <ProductImage src={src} alt="" className="aspect-[3/4] w-full" />
                    </span>
                  ))}
                </span>
              ) : (
                <span
                  className="pointer-events-none absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(70%_70%_at_80%_50%,rgba(20,27,164,.55),transparent_70%)]"
                  aria-hidden="true"
                />
              )}

              <div className="relative max-w-[54%]">
                <h3 className="font-display text-lg font-black leading-tight tracking-tight text-white transition-colors group-hover:text-gold-500">
                  {c.title}
                </h3>
                <p className="mt-2 text-pretty text-xs leading-relaxed text-white/55">
                  {c.subtitle}
                </p>
              </div>

              <div className="relative mt-4 flex items-center gap-2">
                {c.soon ? (
                  <span className="chip border-white/15 bg-white/[.06] text-white/60">
                    <Clock3 className="h-3 w-3" aria-hidden="true" />
                    Próximamente
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-gold-500">
                    Explorar
                    <ArrowUpRight
                      className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      aria-hidden="true"
                    />
                  </span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

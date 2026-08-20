import { Gamepad, MessageCircle, Monitor } from 'lucide-react'
import ProductCard from '@/components/catalog/ProductCard'
import SectionHeading from './SectionHeading'
import { MESSAGES, waLink } from '@/data/site'
import { products } from '@/data/products'

/**
 * Consolas y accesorios. El negocio maneja ambas líneas, pero todavía no
 * entregó fotos ni referencias: se muestra un bloque compacto preparado para
 * recibirlas, en vez de rellenar con texto o productos inventados.
 */
function SoonCard({
  icon: Icon,
  title,
  text,
  message,
}: {
  icon: typeof Gamepad
  title: string
  text: string
  message: string
}) {
  return (
    <div className="surface flex items-center gap-4 p-4 sm:p-5">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-gold-500/25 bg-gold-500/10 text-gold-500">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-display text-[15px] font-extrabold text-white">{title}</h3>
        <p className="mt-0.5 text-2xs text-white/50">{text}</p>
      </div>
      <a
        href={waLink(message)}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-wa h-10 min-h-0 shrink-0 px-3 text-2xs"
      >
        <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
        Consultar
      </a>
    </div>
  )
}

export default function ConsolesAccessories() {
  const consoles = products.filter((p) => p.category === 'consolas')
  const accessories = products.filter((p) => p.category === 'accesorios')
  const hardware = [...consoles, ...accessories]

  if (hardware.length > 0) {
    return (
      <section className="gg-container py-10 sm:py-12" aria-labelledby="hardware-title">
        <SectionHeading
          id="hardware-title"
          eyebrow="Hardware"
          title="Consolas y accesorios"
          linkTo="/catalogo?categoria=consolas"
          linkLabel="Ver todo"
        />
        <ul className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
          {hardware.slice(0, 10).map((p) => (
            <li key={p.slug}>
              <ProductCard product={p} />
            </li>
          ))}
        </ul>
      </section>
    )
  }

  return (
    <section className="gg-container py-10 sm:py-12" aria-labelledby="hardware-title">
      <SectionHeading id="hardware-title" eyebrow="Hardware" title="Consolas y accesorios" />
      <div className="grid gap-3 sm:grid-cols-2">
        <SoonCard
          icon={Monitor}
          title="Consolas"
          text="PS5, PS4 y Nintendo Switch · disponibilidad por WhatsApp"
          message={MESSAGES.consoles}
        />
        <SoonCard
          icon={Gamepad}
          title="Controles y accesorios"
          text="Controles, cables y complementos"
          message={MESSAGES.accessories}
        />
      </div>
    </section>
  )
}

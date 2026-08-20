import { Boxes, Headset, MessageCircle, RefreshCw, Truck } from 'lucide-react'

/** Franja de confianza en una sola línea: sin párrafos de relleno. */
const ITEMS = [
  { icon: Headset, text: 'Atención personalizada' },
  { icon: Truck, text: 'Envíos nacionales' },
  { icon: Boxes, text: 'Catálogo especializado' },
  { icon: RefreshCw, text: 'Nuevos y usados' },
  { icon: MessageCircle, text: 'Todo por WhatsApp' },
]

export default function Trust() {
  return (
    <section className="gg-container py-8" aria-labelledby="confianza-title">
      <h2 id="confianza-title" className="sr-only">
        Compra con confianza
      </h2>
      <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2.5 rounded-card border border-white/10 bg-ink-700/35 px-4 py-3.5 sm:gap-x-6">
        {ITEMS.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-2 text-xs font-semibold text-white/65">
            <Icon className="h-4 w-4 shrink-0 text-gold-500" aria-hidden="true" />
            {text}
          </li>
        ))}
      </ul>
    </section>
  )
}

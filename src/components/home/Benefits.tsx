import { Gamepad2, MessageCircle, RefreshCw, Truck } from 'lucide-react'

/** Franja compacta: informa sin robarle espacio a los productos. */
const BENEFITS = [
  { icon: Truck, title: 'Envíos nacionales', text: 'Medellín y toda Colombia' },
  { icon: Gamepad2, title: 'Amplio catálogo', text: 'PlayStation y Nintendo Switch' },
  { icon: RefreshCw, title: 'Videojuegos usados', text: 'Compra, venta y parte de pago' },
  { icon: MessageCircle, title: 'Atención por WhatsApp', text: 'Te asesoramos directo' },
]

export default function Benefits() {
  return (
    <section aria-label="Beneficios de comprar en GOOD GAME" className="relative">
      <div className="gg-container -mt-2 sm:-mt-4">
        <ul className="grid grid-cols-2 gap-2.5 rounded-card border border-white/10 bg-ink-700/45 p-2.5 sm:gap-3 lg:grid-cols-4">
          {BENEFITS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-center gap-3 rounded-lg px-2 py-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-gold-500/25 bg-gold-500/10 text-gold-500">
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-display text-[13px] font-extrabold leading-tight text-white">
                  {title}
                </span>
                <span className="block truncate text-2xs text-white/50">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

import {
  Clock,
  CreditCard,
  Gamepad2,
  MapPin,
  MessageCircle,
  Package,
  RefreshCw,
  ShieldCheck,
  Truck,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { useCatalogo } from '@/hooks/useCatalogo'

/**
 * Iconos que el panel puede elegir para cada beneficio.
 * Se listan uno a uno a propósito: importar lucide entero para resolver el
 * nombre en tiempo de ejecución metería cientos de iconos en el paquete.
 */
const ICONOS: Record<string, LucideIcon> = {
  Truck,
  Gamepad2,
  RefreshCw,
  MessageCircle,
  ShieldCheck,
  Zap,
  Package,
  CreditCard,
  MapPin,
  Clock,
}

/** Franja compacta: informa sin robarle espacio a los productos. */
export default function Benefits() {
  const { contenido } = useCatalogo()
  const beneficios = contenido.benefits

  if (beneficios.length === 0) return null

  return (
    <section aria-label="Beneficios de comprar en GOOD GAME" className="relative">
      <div className="gg-container -mt-2 sm:-mt-4">
        <ul className="grid grid-cols-2 gap-2.5 rounded-card border border-white/10 bg-ink-700/45 p-2.5 sm:gap-3 lg:grid-cols-4">
          {beneficios.map((b, i) => {
            // Si el panel guarda un icono que no está en esta lista se usa uno
            // neutro, en vez de dejar la portada rota.
            const Icono = ICONOS[b.icon] ?? Package
            return (
              <li
                key={`${b.title}-${i}`}
                className="flex items-center gap-3 rounded-lg px-2 py-2"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-gold-500/25 bg-gold-500/10 text-gold-500">
                  <Icono className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-balance font-display text-[13px] font-extrabold leading-tight text-white">
                    {b.title}
                  </span>
                  <span className="mt-0.5 block text-pretty text-2xs leading-snug text-white/50">
                    {b.description}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

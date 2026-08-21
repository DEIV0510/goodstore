import type { Platform } from '@/types'

/** Acento por plataforma, para que la portada no se vea genérica. */
const ACCENT: Record<Platform, { from: string; to: string; bar: string }> = {
  ps5: { from: '#1B24C9', to: '#070A78', bar: '#5B67F5' },
  ps4: { from: '#141BA4', to: '#060A55', bar: '#3641DC' },
  switch: { from: '#8E1220', to: '#3A0710', bar: '#FF1717' },
  switch2: { from: '#9A2410', to: '#3A0C06', bar: '#FF6A2B' },
  xbox: { from: '#0F6B2F', to: '#062915', bar: '#2ED06A' },
}

interface Props {
  name: string
  platform: Platform
  className?: string
  /** Compacta la maqueta para miniaturas pequeñas (carrito, buscador). */
  compact?: boolean
}

/**
 * Portada generada para los productos que todavía no tienen fotografía.
 * Muestra el título real y la plataforma: nunca se usa la carátula de otro
 * juego ni una imagen de banco.
 */
export default function CoverFallback({ name, platform, className = '', compact = false }: Props) {
  const a = ACCENT[platform] ?? ACCENT.ps5
  const words = name.trim().split(/\s+/)
  const long = name.length > 26

  return (
    <span
      className={`relative flex flex-col overflow-hidden ${className}`}
      style={{ background: `linear-gradient(155deg, ${a.from} 0%, ${a.to} 78%)` }}
      role="img"
      aria-label={`${name} — sin fotografía disponible`}
    >
      {/* Malla técnica */}
      <span
        className="pointer-events-none absolute inset-0 opacity-[.55]"
        aria-hidden="true"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px)',
          backgroundSize: compact ? '12px 12px' : '20px 20px',
        }}
      />
      {/* Brillo superior */}
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
        aria-hidden="true"
        style={{ background: 'radial-gradient(80% 100% at 50% 0%, rgba(255,255,255,.16), transparent 70%)' }}
      />

      {/* Franja superior, como el borde de una caja real.
          No lleva texto: la plataforma ya se muestra en el badge de la tarjeta. */}
      <span
        className="relative shrink-0 border-b border-white/15 bg-black/25"
        style={{ height: compact ? 10 : 18 }}
        aria-hidden="true"
      />

      {/* Título */}
      <span className="relative flex flex-1 items-center justify-center px-[8%] text-center">
        <span
          className={`font-display font-black uppercase leading-[1.1] tracking-tight text-white ${
            compact ? 'text-[7px]' : long ? 'text-[10px] sm:text-xs' : 'text-xs sm:text-sm'
          }`}
          style={{ textShadow: '0 2px 10px rgba(0,0,0,.5)' }}
        >
          {words.slice(0, compact ? 4 : 9).join(' ')}
        </span>
      </span>

      {/* Pie con el acento de la plataforma */}
      <span className="relative shrink-0 px-[8%] pb-[7%]" aria-hidden="true">
        <span className="block h-[3px] w-full rounded-full" style={{ background: a.bar }} />
        {!compact && (
          <span className="mt-2 block text-center text-[7px] font-bold uppercase tracking-[.28em] text-white/45">
            Good Game
          </span>
        )}
      </span>
    </span>
  )
}

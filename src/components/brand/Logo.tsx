import { site } from '@/data/site'

// Proporción real del logotipo oficial: 720 × 239 px (3.013:1).
const RATIO = 720 / 239

/**
 * Mando del logotipo, aislado. Se usa como marca de agua en estados vacíos y
 * en la 404, donde el logotipo completo sería demasiado ancho.
 */
export function LogoMark({ className = 'h-10 w-10' }: { className?: string }) {
  return (
    <img
      src="/brand/mando-blanco.png"
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`select-none object-contain ${className}`}
    />
  )
}

interface LogoProps {
  className?: string
  /** Alto del logotipo en píxeles. El ancho se calcula solo. */
  height?: number
  /** Versión a color (fondo claro o pantalla de carga) en vez de la blanca. */
  color?: boolean
  /** El logotipo ya dice "GOOD GAME · GAME STORE", así que hace de título. */
  as?: 'span' | 'h1'
}

export default function Logo({
  className = '',
  height = 36,
  color = false,
  as: Tag = 'span',
}: LogoProps) {
  const width = Math.round(height * RATIO)
  return (
    <Tag className={`inline-flex items-center ${className}`}>
      <img
        src={color ? '/brand/logo-color.png' : '/brand/logo-blanco.png'}
        alt={`${site.name} — ${site.tagline}`}
        width={width}
        height={height}
        draggable={false}
        className="block h-auto w-auto select-none object-contain"
        style={{ height, width }}
      />
    </Tag>
  )
}

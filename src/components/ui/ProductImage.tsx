import { ImageOff } from 'lucide-react'
import { useState } from 'react'

interface Props {
  src?: string
  alt: string
  className?: string
  /** Las portadas del hero y de las primeras tarjetas no deben ir en lazy. */
  priority?: boolean
  sizes?: string
}

/**
 * Portada de producto con tres estados: cargando (skeleton), cargada y error.
 * Reserva el espacio con aspect-ratio para no provocar saltos de layout (CLS).
 */
export default function ProductImage({
  src,
  alt,
  className = '',
  priority = false,
  sizes,
}: Props) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>(
    src ? 'loading' : 'error'
  )

  return (
    <span className={`relative block overflow-hidden ${className}`}>
      {state === 'loading' && <span className="skeleton absolute inset-0 block" aria-hidden="true" />}

      {state === 'error' ? (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink-600/60 px-3 text-center">
          <ImageOff className="h-6 w-6 text-white/30" aria-hidden="true" />
          <span className="text-2xs font-semibold uppercase tracking-wider text-white/40">
            Imagen no disponible
          </span>
        </span>
      ) : (
        <img
          src={src}
          alt={alt}
          sizes={sizes}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          // React 18 no reconoce `fetchPriority` en camelCase: se pasa como atributo HTML.
          {...{ fetchpriority: priority ? 'high' : 'auto' }}
          onLoad={() => setState('ready')}
          onError={() => setState('error')}
          className={`h-full w-full object-contain transition-opacity duration-500 ${
            state === 'ready' ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </span>
  )
}

import { useState } from 'react'
import CoverFallback from './CoverFallback'
import type { Platform } from '@/types'

interface Props {
  src?: string
  alt: string
  className?: string
  /** Las portadas del hero y de las primeras tarjetas no deben ir en lazy. */
  priority?: boolean
  sizes?: string
  /** Si no hay foto (o falla), se dibuja una portada de marca con estos datos. */
  fallback?: { name: string; platform: Platform; compact?: boolean }
}

/**
 * Portada de producto con tres estados: cargando (skeleton), cargada y error.
 * Reserva el espacio con aspect-ratio para no provocar saltos de layout (CLS).
 * Cuando el producto no tiene fotografía se dibuja una portada de marca con el
 * título real: nunca se muestra la carátula de otro juego.
 */
export default function ProductImage({
  src,
  alt,
  className = '',
  priority = false,
  sizes,
  fallback,
}: Props) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>(
    src ? 'loading' : 'error'
  )

  if (state === 'error' && fallback) {
    return (
      <CoverFallback
        name={fallback.name}
        platform={fallback.platform}
        compact={fallback.compact}
        className={`${className} h-full w-full`}
      />
    )
  }

  return (
    <span className={`relative block overflow-hidden ${className}`}>
      {state === 'loading' && <span className="skeleton absolute inset-0 block" aria-hidden="true" />}

      {state === 'error' ? (
        <span className="absolute inset-0 flex items-center justify-center bg-ink-600/60 px-3 text-center">
          <span className="text-2xs font-semibold uppercase tracking-wider text-white/40">
            Sin imagen
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

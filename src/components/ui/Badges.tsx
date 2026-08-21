import { CheckCircle2, CircleSlash, Globe, HelpCircle, Sparkles } from 'lucide-react'
import { platformShort, regionLabel } from '@/data/taxonomy'
import type { Condition, Platform, Product, Region } from '@/types'

const PLATFORM_STYLE: Record<Platform, string> = {
  ps5: 'border-blue-300/45 bg-blue-500/20 text-blue-100',
  ps4: 'border-blue-300/45 bg-blue-600/25 text-blue-100',
  switch: 'border-alert-500/45 bg-alert-500/15 text-red-100',
  switch2: 'border-orange-400/45 bg-orange-500/15 text-orange-100',
  xbox: 'border-emerald-400/45 bg-emerald-500/15 text-emerald-100',
}

export function PlatformBadge({ platform }: { platform: Platform }) {
  return (
    <span className={`chip ${PLATFORM_STYLE[platform]}`}>{platformShort(platform)}</span>
  )
}

export function ConditionBadge({ condition }: { condition: Condition }) {
  if (condition === 'nuevo')
    return (
      <span className="chip border-gold-500/45 bg-gold-500/15 text-gold-300">
        <Sparkles className="h-3 w-3" aria-hidden="true" /> Nuevo
      </span>
    )
  if (condition === 'usado')
    return (
      <span className="chip border-white/20 bg-white/[.08] text-white/75">Usado</span>
    )
  return (
    <span className="chip border-white/15 bg-white/[.05] text-white/55">
      <HelpCircle className="h-3 w-3" aria-hidden="true" /> Estado a confirmar
    </span>
  )
}

/** Un producto se considera disponible salvo que su stock sea 0. */
export const isAvailable = (p: Product) => p.stock === null || p.stock > 0

export function StockBadge({ product }: { product: Product }) {
  if (!isAvailable(product))
    return (
      <span className="inline-flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-alert-400">
        <CircleSlash className="h-3.5 w-3.5" aria-hidden="true" /> Agotado
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-emerald-300">
      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Disponible
    </span>
  )
}

/**
 * La región solo se muestra cuando NO es América: en Colombia lo normal es
 * América, y una copia europea o japonesa cambia idioma y compatibilidad.
 */
export function RegionBadge({ region }: { region: Region | null }) {
  if (!region || region === 'america') return null
  return (
    <span className="chip border-white/20 bg-white/[.07] text-white/75">
      <Globe className="h-3 w-3" aria-hidden="true" /> {regionLabel(region)}
    </span>
  )
}

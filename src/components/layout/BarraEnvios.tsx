import { Truck } from 'lucide-react'
import { useLayoutEffect, useRef } from 'react'
import { site } from '@/data/site'
import { hayTarifasEnvio } from '@/lib/envio'
import { cop } from '@/lib/format'

// ─────────────────────────────────────────────────────────────────────────────
// Barra fina con las tarifas de envío, encima de la navegación.
//
// La pidió el negocio para que el precio del envío «no quede en el aire»: no va
// sumado al de cada juego —quien lleva dos pagaría dos envíos—, y si no se dice
// en ningún sitio el cliente descubre el costo cuando ya pagó.
//
// Va DENTRO de la cabecera fija, así que todo lo que se aparta de la cabecera
// (el contenido, los filtros pegajosos del catálogo, el salto a un ancla) tiene
// que contar también su alto. Por eso publica su alto real en --gg-barra: si en
// un móvil estrecho el texto baja a dos líneas, o no hay tarifas y la barra no
// se pinta, la página se entera sola, sin números mágicos repartidos.
//
// En el móvil el texto es más corto («nacional» en vez de «al resto del país»,
// sin la salvedad) para que quepa en una línea desde 360 px; la salvedad de
// que puede variar sigue estando en el carrito, el pago y la ficha.
// ─────────────────────────────────────────────────────────────────────────────

export default function BarraEnvios() {
  const ref = useRef<HTMLDivElement>(null)
  const visible = hayTarifasEnvio()

  useLayoutEffect(() => {
    const raiz = document.documentElement
    const barra = ref.current
    if (!visible || !barra) {
      raiz.style.setProperty('--gg-barra', '0px')
      return
    }
    const medir = () => raiz.style.setProperty('--gg-barra', `${barra.offsetHeight}px`)
    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(barra)
    return () => observador.disconnect()
  }, [visible])

  if (!visible) return null

  const { area, nacional } = site.envio
  const precio = (valor: number) => (
    <strong className="tabular font-bold text-gold-500">{cop(valor)}</strong>
  )

  return (
    <div ref={ref} className="border-b border-white/10 bg-ink-900">
      <p className="gg-container flex min-h-[31px] items-center justify-center gap-2 py-1.5 text-center text-[12px] leading-snug text-white/80">
        <Truck className="h-3.5 w-3.5 shrink-0 text-gold-500 max-sm:hidden" aria-hidden="true" />
        <span>
          Envío
          {area !== null && (
            <>
              {' '}
              {precio(area)} <span className="sm:hidden">Valle de Aburrá</span>
              <span className="max-sm:hidden">en el Valle de Aburrá</span>
            </>
          )}
          {area !== null && nacional !== null && (
            <>
              <span className="sr-only">,</span>
              <span aria-hidden="true" className="text-white/35">
                {' · '}
              </span>
            </>
          )}
          {nacional !== null && (
            <>
              {area === null && ' '}
              {precio(nacional)} <span className="sm:hidden">nacional</span>
              <span className="max-sm:hidden">al resto del país</span>
            </>
          )}
          <span className="max-md:hidden"> · Puede variar en casos puntuales</span>
        </span>
      </p>
    </div>
  )
}

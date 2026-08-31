import { Check, Copy, ExternalLink, MessageCircle, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { site } from '@/data/site'
import { cop } from '@/lib/format'
import { copiar, importeParaPegar } from '@/lib/pago'
import { cartMessage } from '@/lib/whatsapp'
import type { CartEntry } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Pasos para pagar en línea.
//
// El enlace de cobro es de monto abierto: la pasarela pide el importe y NO
// acepta que se le pase hecho. Además solo le entrega al negocio un pago y unos
// datos de envío, sin saber qué juegos son. Así que este panel resuelve las dos
// cosas que faltan:
//
//   · que el cliente no teclee mal el total  → se lo copia al portapapeles;
//   · que el negocio sepa qué enviar         → referencia + pedido por WhatsApp.
//
// El orden de los pasos no es casual: primero el pedido y luego el pago. Si
// alguien paga y se va sin escribir, al negocio le queda un ingreso suelto que
// no sabe a quién corresponde.
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  entries: CartEntry[]
  total: number
  referencia: string
}

/** Un paso, con su número, su marca de hecho y su contenido. */
function Paso({
  n,
  titulo,
  descripcion,
  hecho,
  children,
}: {
  n: number
  titulo: string
  descripcion: string
  hecho: boolean
  children: React.ReactNode
}) {
  return (
    <li className="relative pl-11">
      <span
        aria-hidden="true"
        className={`absolute left-0 top-0 grid h-8 w-8 place-items-center rounded-full border text-sm font-black transition-colors ${
          hecho
            ? 'border-gold-500 bg-gold-500 text-ink-900'
            : 'border-white/20 bg-white/[.06] text-white/70'
        }`}
      >
        {hecho ? <Check className="h-4 w-4" /> : n}
      </span>

      <h3 className="font-display text-[15px] font-extrabold leading-tight text-white">
        {titulo}
        {hecho && <span className="sr-only"> (hecho)</span>}
      </h3>
      <p className="mt-1 text-[13px] leading-relaxed text-white/60">{descripcion}</p>
      <div className="mt-3">{children}</div>
    </li>
  )
}

export default function PagoEnLinea({ entries, total, referencia }: Props) {
  const [copiado, setCopiado] = useState(false)
  const [falloCopia, setFalloCopia] = useState(false)
  const [pedidoEnviado, setPedidoEnviado] = useState(false)
  const [pagoAbierto, setPagoAbierto] = useState(false)

  const importe = importeParaPegar(total)

  async function copiarTotal() {
    const bien = await copiar(importe)
    setCopiado(bien)
    setFalloCopia(!bien)
    if (bien) window.setTimeout(() => setCopiado(false), 2500)
  }

  return (
    <div className="px-4 py-5">
      {/* ── Referencia del pedido ─────────────────────────────────────────── */}
      <div className="rounded-xl border border-gold-500/30 bg-gold-500/[.07] px-4 py-3">
        <p className="text-2xs font-bold uppercase tracking-[.18em] text-gold-500">
          Referencia de tu pedido
        </p>
        <p className="tabular mt-1 select-all font-display text-xl font-black text-white">
          {referencia}
        </p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-white/60">
          Con este código emparejamos tu pago con tu pedido. Va incluido en el mensaje
          de WhatsApp.
        </p>
      </div>

      <ol className="mt-6 space-y-7">
        {/* ── 1. El pedido ────────────────────────────────────────────────── */}
        <Paso
          n={1}
          titulo="Envíanos tu pedido"
          descripcion={`La pasarela solo nos avisa del pago, no de qué juegos pediste. Este mensaje es lo que nos dice qué enviarte.`}
          hecho={pedidoEnviado}
        >
          <a
            href={cartMessage(entries, referencia)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setPedidoEnviado(true)}
            className="btn-wa w-full"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            Enviar por WhatsApp
          </a>
        </Paso>

        {/* ── 2. El total ─────────────────────────────────────────────────── */}
        <Paso
          n={2}
          titulo="Copia el total exacto"
          descripcion={`En ${site.pago.proveedor} tendrás que escribir cuánto vas a pagar. Cópialo de aquí y pégalo: así no hay forma de equivocarse.`}
          hecho={copiado}
        >
          <div className="flex items-stretch gap-2">
            <p className="tabular flex min-w-0 flex-1 select-all items-center justify-center rounded-xl border border-white/12 bg-white/[.05] px-3 font-display text-lg font-black text-white">
              {importe}
            </p>
            <button
              type="button"
              onClick={() => void copiarTotal()}
              className="btn-secondary shrink-0 px-4"
            >
              {copiado ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4" aria-hidden="true" />
              )}
              {copiado ? 'Copiado' : 'Copiar'}
            </button>
          </div>

          <p className="mt-2 text-[12.5px] text-white/50" aria-live="polite">
            {falloCopia
              ? 'Tu navegador no dejó copiar. Selecciona el número y cópialo a mano.'
              : `Son ${cop(total)}. Se escribe sin puntos ni signo de pesos.`}
          </p>
        </Paso>

        {/* ── 3. El pago ──────────────────────────────────────────────────── */}
        <Paso
          n={3}
          titulo={`Paga con ${site.pago.proveedor}`}
          descripcion="Se abre en una pestaña nueva. Ahí eliges el medio de pago y escribes tus datos de envío."
          hecho={pagoAbierto}
        >
          <a
            href={site.pago.enlace}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setPagoAbierto(true)}
            className="btn-primary w-full"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Ir a pagar
          </a>

          <p className="mt-2.5 flex items-start gap-1.5 text-[12.5px] leading-relaxed text-white/55">
            <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-white/40" aria-hidden="true" />
            El pago se procesa en la plataforma de {site.pago.proveedor}. GOOD GAME no ve
            ni guarda los datos de tu tarjeta o tu cuenta.
          </p>

          {site.pago.nota && (
            <p className="mt-2 text-[12.5px] leading-relaxed text-white/55">
              {site.pago.nota}
            </p>
          )}
        </Paso>
      </ol>

      <p className="mt-7 rounded-lg border border-white/10 bg-white/[.03] px-3 py-2.5 text-[12.5px] leading-relaxed text-white/55">
        ¿Prefieres coordinar por chat? Vuelve atrás y usa «Pedir por WhatsApp»: te
        confirmamos disponibilidad y envío antes de que pagues nada.
      </p>
    </div>
  )
}

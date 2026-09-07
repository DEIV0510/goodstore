import { Check, Copy, ExternalLink, MessageCircle, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import DatosDelCliente from '@/components/cart/DatosDelCliente'
import { site } from '@/data/site'
import { mensajeDeError } from '@/lib/api'
import { cop } from '@/lib/format'
import {
  copiar,
  guardarDatos,
  importeParaPegar,
  irALaPasarela,
  prepararPago,
  type DatosCliente,
  type PedidoPreparado,
} from '@/lib/pago'
import { cartMessage } from '@/lib/whatsapp'
import type { CartEntry } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Cerrar la compra sin hablar con nadie.
//
// Un solo recorrido, en dos pasos:
//
//   1. Datos      — quién es y a dónde enviarlo. Aquí se REGISTRA el pedido y
//                   el negocio recibe su aviso por correo, pase lo que pase
//                   después: si el cliente se arrepiente en la pasarela, al
//                   menos ya se sabe qué quería y cómo contactarlo.
//   2. Pago       — según cómo cobre el negocio:
//                     · checkout — a la pasarela, con el importe firmado;
//                     · enlace   — de monto abierto, así que hay que copiarle
//                                  el total al portapapeles para que no lo
//                                  teclee mal.
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  entries: CartEntry[]
  total: number
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

export default function PagoEnLinea({ entries, total }: Props) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pedido, setPedido] = useState<PedidoPreparado | null>(null)

  /**
   * Registra el pedido con los datos del cliente.
   *
   * A partir de aquí el negocio ya sabe qué le están pidiendo y a quién, aunque
   * el cliente no llegue a pagar: por eso se hace ANTES de mandarlo a la
   * pasarela y no después.
   */
  async function continuar(datos: DatosCliente) {
    setEnviando(true)
    setError(null)
    try {
      const r = await prepararPago(
        entries.map((e) => ({ slug: e.product.slug, qty: e.qty })),
        datos
      )
      guardarDatos(datos)

      if (r.modo === 'checkout') {
        // El navegador se va a la pasarela; el estado de carga se queda puesto
        // a propósito para que nadie pulse dos veces.
        setPedido(r)
        irALaPasarela(r)
        return
      }
      setPedido(r)
    } catch (e) {
      setError(mensajeDeError(e))
    } finally {
      setEnviando(false)
    }
  }

  // ── 1. Los datos ─────────────────────────────────────────────────────────
  if (!pedido) {
    return (
      <DatosDelCliente
        total={total}
        enviando={enviando}
        errorServidor={error}
        onContinuar={(d) => void continuar(d)}
      />
    )
  }

  // ── 2a. Checkout Web: ya se está yendo a la pasarela ─────────────────────
  if (pedido.modo === 'checkout') {
    return <YendoAPagar pedido={pedido.pedido} total={total} />
  }

  // ── 2b. Enlace de cobro: los pasos, ya con el pedido registrado ──────────
  return (
    <PagoPorEnlace
      entries={entries}
      total={total}
      referencia={pedido.referencia}
      enlace={pedido.enlace}
    />
  )
}

/** Pantalla de paso mientras el navegador salta a la pasarela. */
function YendoAPagar({ pedido, total }: { pedido: string; total: number }) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-2xs font-bold uppercase tracking-[.18em] text-white/50">
        Tu pedido {pedido}
      </p>
      <p className="tabular mt-2 font-display text-3xl font-black text-gold-500">
        {cop(total)}
      </p>
      <p className="mt-4 text-sm leading-relaxed text-white/60">
        Te estamos llevando al pago seguro de {site.pago.proveedor}…
      </p>
      <p className="mt-3 text-[12.5px] leading-relaxed text-white/45">
        Si no pasa nada en unos segundos, revisa que el navegador no esté bloqueando
        la redirección. Tu pedido ya quedó registrado.
      </p>
    </div>
  )
}

/** Los tres pasos del enlace de cobro de monto abierto. */
function PagoPorEnlace({
  entries,
  total,
  referencia,
  enlace,
}: Props & { referencia: string; enlace: string }) {
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
          Ya lo tenemos registrado con tus datos. Con este código reconocemos tu pago
          en cuanto entre.
        </p>
      </div>

      <ol className="mt-6 space-y-7">
        {/* ── 1. El pedido ────────────────────────────────────────────────── */}
        <Paso
          n={1}
          titulo="Avísanos que vas a pagar"
          descripcion="Tu pedido ya nos llegó con tus datos. Este mensaje nos deja la referencia a mano para reconocer tu pago en cuanto entre."
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
            href={enlace || site.pago.enlace}
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

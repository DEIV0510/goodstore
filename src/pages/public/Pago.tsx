import { AlertTriangle, CheckCircle2, Clock, Home, MessageCircle, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MESSAGES, site, waLink } from '@/data/site'
import { api, mensajeDeError } from '@/lib/api'
import { cop } from '@/lib/format'
import { useSeo } from '@/lib/seo'
import { useStore } from '@/store/StoreContext'
import type { PaymentResult } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Vuelta de la pasarela.
//
// Wompi devuelve al cliente aquí con el id de la transacción en la dirección.
// Ese id NO se cree: se le pregunta al servidor, que a su vez le pregunta a
// Wompi con la llave del negocio. Si el estado viniera en la URL, cualquiera
// podría escribir «aprobado» y ver una pantalla de éxito que no es verdad.
//
// El carrito solo se vacía cuando el pago está APROBADO. Si quedó pendiente o
// lo rechazaron, el cliente encuentra sus productos donde los dejó y puede
// volver a intentarlo sin rearmar nada.
// ─────────────────────────────────────────────────────────────────────────────

type Estado =
  | { fase: 'consultando' }
  | { fase: 'listo'; datos: PaymentResult }
  | { fase: 'error'; mensaje: string }
  | { fase: 'sin-id' }

const ICONO: Record<string, { Icono: typeof CheckCircle2; color: string; titulo: string }> = {
  APPROVED: { Icono: CheckCircle2, color: 'text-emerald-400', titulo: 'Pago aprobado' },
  PENDING: { Icono: Clock, color: 'text-gold-500', titulo: 'Pago en proceso' },
  DECLINED: { Icono: XCircle, color: 'text-alert-400', titulo: 'Pago rechazado' },
  VOIDED: { Icono: XCircle, color: 'text-alert-400', titulo: 'Pago anulado' },
  ERROR: { Icono: AlertTriangle, color: 'text-alert-400', titulo: 'No se pudo completar' },
  REVISAR: { Icono: AlertTriangle, color: 'text-gold-500', titulo: 'Hay que revisarlo' },
}

export default function Pago() {
  const [params] = useSearchParams()
  const id = params.get('id')
  const { clearCart } = useStore()
  const [estado, setEstado] = useState<Estado>(id ? { fase: 'consultando' } : { fase: 'sin-id' })

  useSeo({
    title: `Estado de tu pago | ${site.name}`,
    description: 'Resultado de tu pago en línea en GOOD GAME.',
    path: '/pago',
    // Una página de resultado no tiene nada que hacer en Google, y además
    // llevaría un identificador de transacción en la dirección.
    noindex: true,
  })

  useEffect(() => {
    if (!id) return
    let vivo = true

    api<PaymentResult>('pago/estado', { parametros: { id } })
      .then((datos) => {
        if (!vivo) return
        setEstado({ fase: 'listo', datos })
        // Solo se vacía con el pago aprobado: si falló, el cliente conserva su
        // carrito y puede reintentarlo sin volver a buscar los juegos.
        if (datos.estado === 'APPROVED') clearCart()
      })
      .catch((e) => {
        if (vivo) setEstado({ fase: 'error', mensaje: mensajeDeError(e) })
      })

    return () => {
      vivo = false
    }
  }, [id, clearCart])

  const wa = waLink(MESSAGES.general)

  return (
    <div className="gg-container flex min-h-[60vh] items-center justify-center py-16">
      <div className="surface w-full max-w-lg p-6 text-center sm:p-8">
        {estado.fase === 'consultando' && (
          <>
            <span className="mx-auto grid h-14 w-14 animate-pulse place-items-center rounded-2xl border border-white/10 bg-white/[.05]">
              <Clock className="h-6 w-6 text-white/50" aria-hidden="true" />
            </span>
            <h1 className="mt-5 font-display text-xl font-extrabold text-white">
              Confirmando tu pago…
            </h1>
            <p className="mt-2 text-sm text-white/60">
              Estamos preguntándole a la pasarela. Es cuestión de segundos.
            </p>
          </>
        )}

        {estado.fase === 'sin-id' && (
          <>
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[.05]">
              <AlertTriangle className="h-6 w-6 text-gold-500" aria-hidden="true" />
            </span>
            <h1 className="mt-5 font-display text-xl font-extrabold text-white">
              Aquí no hay ningún pago que mostrar
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              A esta página se llega al volver de la pasarela. Si acabas de pagar y ves
              esto, escríbenos y lo comprobamos con tu comprobante.
            </p>
          </>
        )}

        {estado.fase === 'error' && (
          <>
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-alert-500/30 bg-alert-500/10">
              <AlertTriangle className="h-6 w-6 text-alert-400" aria-hidden="true" />
            </span>
            <h1 className="mt-5 font-display text-xl font-extrabold text-white">
              No pudimos comprobar el pago
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-white/60">{estado.mensaje}</p>
            <p className="mt-3 text-sm leading-relaxed text-white/60">
              <strong className="text-white">Puede que el pago sí se haya hecho.</strong>{' '}
              Escríbenos con tu comprobante antes de volver a intentarlo, para no pagar dos
              veces.
            </p>
          </>
        )}

        {estado.fase === 'listo' && (
          <ResultadoDelPago datos={estado.datos} />
        )}

        <div className="mt-7 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          <Link to="/" className="btn-secondary">
            <Home className="h-4 w-4" aria-hidden="true" />
            Ir a la tienda
          </Link>
          <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-wa">
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            Escribirnos
          </a>
        </div>
      </div>
    </div>
  )
}

function ResultadoDelPago({ datos }: { datos: PaymentResult }) {
  const info = ICONO[datos.estado] ?? {
    Icono: AlertTriangle,
    color: 'text-white/60',
    titulo: 'Estado desconocido',
  }
  const { Icono, color, titulo } = info
  const aprobado = datos.estado === 'APPROVED'

  return (
    <>
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[.05]">
        <Icono className={`h-7 w-7 ${color}`} aria-hidden="true" />
      </span>

      <h1 className="mt-5 font-display text-xl font-extrabold text-white">{titulo}</h1>
      <p className="mt-2 text-sm leading-relaxed text-white/65">{datos.mensaje}</p>

      {datos.pedido && (
        <dl className="mt-5 space-y-2 rounded-xl border border-white/10 bg-white/[.03] px-4 py-3.5 text-left text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-white/55">Tu pedido</dt>
            <dd className="tabular font-display font-extrabold text-white">{datos.pedido}</dd>
          </div>
          {datos.total > 0 && (
            <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-2">
              <dt className="text-white/55">{aprobado ? 'Pagado' : 'Valor'}</dt>
              <dd className="tabular font-display font-extrabold text-gold-500">
                {cop(datos.pagado ?? datos.total)}
              </dd>
            </div>
          )}
        </dl>
      )}

      {aprobado && (
        <p className="mt-4 text-[13px] leading-relaxed text-white/60">
          Ya tenemos tu pedido registrado. Te escribimos por WhatsApp para cuadrar el envío.
          Guarda el número de pedido por si necesitas consultarnos algo.
        </p>
      )}

      {datos.estado === 'PENDING' && (
        <p className="mt-4 text-[13px] leading-relaxed text-white/60">
          No hace falta que pagues otra vez. En cuanto la entidad lo confirme, tu pedido
          queda listo y te avisamos.
        </p>
      )}

      {datos.estado === 'REVISAR' && datos.pagado !== undefined && (
        <p className="mt-4 rounded-lg border border-gold-500/25 bg-gold-500/[.07] px-3 py-2.5 text-[13px] leading-relaxed text-gold-300">
          Pagaste {cop(datos.pagado)} y el pedido era de {cop(datos.total)}. No lo damos por
          cerrado hasta hablar contigo: escríbenos y lo resolvemos.
        </p>
      )}
    </>
  )
}

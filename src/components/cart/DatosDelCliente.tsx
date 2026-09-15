import { ArrowRight, ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { hayTarifasEnvio, tarifasEnvioTexto } from '@/lib/envio'
import { cop } from '@/lib/format'
import { DATOS_VACIOS, datosGuardados, type DatosCliente } from '@/lib/pago'

// ─────────────────────────────────────────────────────────────────────────────
// Los datos con los que el cliente cierra su compra solo.
//
// Cuatro campos obligatorios y uno opcional. Menos no alcanza para despachar un
// pedido; más y la gente abandona el carrito. La dirección se pide aquí y no en
// la pasarela porque el negocio la necesita aunque el pago se quede a medias.
//
// Se recuerdan en este navegador: quien vuelve a comprar solo confirma.
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  total: number
  enviando: boolean
  errorServidor: string | null
  onContinuar: (datos: DatosCliente) => void
}

/** Un campo del formulario, con su error debajo. */
function Campo({
  id,
  etiqueta,
  valor,
  onCambio,
  error,
  ayuda,
  ...resto
}: {
  id: string
  etiqueta: string
  valor: string
  onCambio: (v: string) => void
  error?: string
  ayuda?: string
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const idAyuda = `${id}-ayuda`
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-bold text-white/80">
        {etiqueta}
      </label>
      <input
        {...resto}
        id={id}
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || ayuda ? idAyuda : undefined}
        className={`min-h-[44px] w-full rounded-xl border bg-white/[.05] px-3.5 text-[15px] text-white
          placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold-500/60
          ${error ? 'border-alert-500' : 'border-white/12'}`}
      />
      {(error || ayuda) && (
        <p
          id={idAyuda}
          className={`mt-1.5 text-[12.5px] leading-relaxed ${
            error ? 'text-alert-400' : 'text-white/45'
          }`}
        >
          {error ?? ayuda}
        </p>
      )}
    </div>
  )
}

export default function DatosDelCliente({
  total,
  enviando,
  errorServidor,
  onContinuar,
}: Props) {
  const [datos, setDatos] = useState<DatosCliente>(() => datosGuardados())
  const [errores, setErrores] = useState<Partial<Record<keyof DatosCliente, string>>>({})

  const editar = (campo: keyof DatosCliente) => (v: string) => {
    setDatos((d) => ({ ...d, [campo]: v }))
    setErrores((e) => (e[campo] ? { ...e, [campo]: undefined } : e))
  }

  function enviar(e: FormEvent) {
    e.preventDefault()
    const fallos: Partial<Record<keyof DatosCliente, string>> = {}

    if (datos.nombre.trim().length < 3) {
      fallos.nombre = 'Escribe tu nombre y apellido.'
    }
    // Diez dígitos: un celular colombiano. Se admite que lo escriba con +57,
    // espacios o guiones, que es como lo teclea todo el mundo.
    const digitos = datos.whatsapp.replace(/\D/g, '').replace(/^57(?=\d{10}$)/, '')
    if (digitos.length !== 10) {
      fallos.whatsapp = 'Tu celular a 10 dígitos, para coordinar el envío.'
    }
    if (datos.ciudad.trim().length < 3) {
      fallos.ciudad = '¿A qué ciudad lo enviamos?'
    }
    if (datos.direccion.trim().length < 6) {
      fallos.direccion = 'Escribe la dirección completa, con barrio si aplica.'
    }
    if (datos.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(datos.email.trim())) {
      fallos.email = 'Ese correo no parece válido. Puedes dejarlo vacío.'
    }

    if (Object.keys(fallos).length > 0) {
      setErrores(fallos)
      return
    }

    setErrores({})
    onContinuar({ ...datos, whatsapp: digitos })
  }

  return (
    <form onSubmit={enviar} noValidate className="px-4 py-5">
      <div className="rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-center">
        <p className="text-2xs font-bold uppercase tracking-[.18em] text-white/50">
          {hayTarifasEnvio() ? 'Total sin envío' : 'Total de tu pedido'}
        </p>
        <p className="tabular mt-1 font-display text-2xl font-black text-gold-500">
          {cop(total)}
        </p>
        {hayTarifasEnvio() && (
          <p className="mt-1.5 text-[12px] leading-relaxed text-white/60">
            Envío aparte: {tarifasEnvioTexto()}. Puede variar en casos puntuales.
          </p>
        )}
      </div>

      <p className="mt-5 text-[13px] leading-relaxed text-white/60">
        Con estos datos preparamos tu envío. Los guardamos en este navegador para que
        la próxima vez solo tengas que confirmarlos.
      </p>

      <div className="mt-4 space-y-4">
        <Campo
          id="pago-nombre"
          etiqueta="Nombre y apellido"
          valor={datos.nombre}
          onCambio={editar('nombre')}
          error={errores.nombre}
          autoComplete="name"
          placeholder="Juan Pérez"
        />

        <Campo
          id="pago-whatsapp"
          etiqueta="WhatsApp"
          valor={datos.whatsapp}
          onCambio={editar('whatsapp')}
          error={errores.whatsapp}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="300 123 4567"
          ayuda="Por aquí te confirmamos el envío."
        />

        <Campo
          id="pago-ciudad"
          etiqueta="Ciudad"
          valor={datos.ciudad}
          onCambio={editar('ciudad')}
          error={errores.ciudad}
          autoComplete="address-level2"
          placeholder="Medellín"
        />

        <Campo
          id="pago-direccion"
          etiqueta="Dirección de envío"
          valor={datos.direccion}
          onCambio={editar('direccion')}
          error={errores.direccion}
          autoComplete="street-address"
          placeholder="Cra 50 #30-12, apto 301, barrio Centro"
        />

        <Campo
          id="pago-email"
          etiqueta="Correo (opcional)"
          valor={datos.email}
          onCambio={editar('email')}
          error={errores.email}
          type="email"
          inputMode="email"
          autoComplete="email"
          spellCheck={false}
          placeholder="tucorreo@ejemplo.com"
          ayuda="Si lo dejas, te mandamos el comprobante de tu compra."
        />
      </div>

      {errorServidor && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-alert-500/30 bg-alert-500/10 px-3 py-2.5 text-[12.5px] leading-relaxed text-alert-400"
        >
          {errorServidor}
        </p>
      )}

      <button type="submit" disabled={enviando} className="btn-primary mt-5 w-full">
        {enviando ? 'Registrando tu pedido…' : 'Continuar'}
        {!enviando && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
      </button>

      <p className="mt-3 flex items-start gap-1.5 text-[12.5px] leading-relaxed text-white/50">
        <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-white/35" aria-hidden="true" />
        Tus datos se usan solo para gestionar este pedido. No se comparten con nadie
        más ni se usan para publicidad.
      </p>

      <button
        type="button"
        onClick={() => {
          setDatos(DATOS_VACIOS)
          setErrores({})
        }}
        className="btn-ghost mt-2 w-full text-xs text-white/40"
      >
        Limpiar los datos guardados
      </button>
    </form>
  )
}

import { AlertTriangle, Link2, RotateCcw } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { useAvisos } from '@/components/admin/Avisos'
import { useConfirmar } from '@/components/admin/Modal'
import {
  AreaTexto,
  BotonGuardar,
  Cargando,
  Encabezado,
  Entrada,
  ErrorEstado,
} from '@/components/admin/UI'
import { platformShort } from '@/data/taxonomy'
import { cop } from '@/lib/format'
import { rellenar } from '@/lib/whatsapp'
import {
  WHATSAPP_POR_OMISION,
  guardarWhatsapp,
  normalizarWhatsapp,
  obtenerWhatsapp,
} from '@/services/ajustes'
import { listarProductos } from '@/services/catalogo'
import type { Product, WhatsappSettings } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// WhatsApp: número y mensajes previos.
//
// Toda la venta de GOOD GAME termina en un chat, así que esta pantalla es la
// que decide qué le llega al negocio. Dos ideas la gobiernan:
//
//   · el número se guarda SIN indicativo (10 dígitos) y el +57 lo pone la
//     tienda al construir el enlace, para que nadie lo escriba dos veces;
//   · la vista previa de la ficha de producto se rellena con un producto REAL
//     del catálogo. Si el catálogo está vacío no se inventa ninguno: se dice.
// ─────────────────────────────────────────────────────────────────────────────

type ClavePlantilla = keyof WhatsappSettings['templates']

/** Cada plantilla con el sitio exacto de la tienda desde el que se dispara. */
const PLANTILLAS: { clave: ClavePlantilla; titulo: string; cuando: string }[] = [
  {
    clave: 'general',
    titulo: 'Mensaje general',
    cuando: 'Botón de WhatsApp del encabezado y botón flotante de la tienda.',
  },
  {
    clave: 'catalog',
    titulo: 'Catálogo',
    cuando: 'Botón «Comprar por WhatsApp» de la portada.',
  },
  {
    clave: 'product',
    titulo: 'Ficha de producto',
    cuando: 'Botón de WhatsApp dentro de la ficha de un juego, consola o accesorio.',
  },
  {
    clave: 'cart',
    titulo: 'Carrito',
    cuando:
      'Primera línea del mensaje del carrito. Debajo se añaden solos los productos y el total.',
  },
  {
    clave: 'used',
    titulo: 'Juegos usados',
    cuando: 'Formulario de venta o entrega de juegos usados.',
  },
  {
    clave: 'consoles',
    titulo: 'Consolas',
    cuando: 'Sección de consolas de la portada.',
  },
  {
    clave: 'accessories',
    titulo: 'Accesorios',
    cuando: 'Sección de accesorios de la portada.',
  },
  {
    clave: 'shipping',
    titulo: 'Envíos',
    cuando: 'Botones de consulta sobre envíos y cobertura.',
  },
]

/** Huecos que la tienda sustituye en la plantilla de la ficha de producto. */
const HUECOS: { hueco: string; que: string }[] = [
  { hueco: '{producto}', que: 'nombre del producto' },
  { hueco: '{plataforma}', que: 'PS5, PS4, Switch…' },
  { hueco: '{precio}', que: 'precio entre paréntesis, o nada si no tiene' },
]

/**
 * Deja solo dígitos y descarta el indicativo cuando lo pegan completo
 * (573508271637 → 3508271637). Ningún móvil colombiano de 10 dígitos empieza
 * por 57, así que quitarlo solo cuando sobra longitud nunca mutila uno válido.
 */
function soloNumero(valor: string): string {
  let digitos = valor.replace(/\D/g, '')
  if (digitos.length > 10 && digitos.startsWith('57')) digitos = digitos.slice(2)
  return digitos.slice(0, 10)
}

export default function Whatsapp() {
  const avisos = useAvisos()
  const confirmar = useConfirmar()

  const [numero, setNumero] = useState('')
  const [plantillas, setPlantillas] = useState(WHATSAPP_POR_OMISION.templates)
  /** Última versión confirmada por el servidor: revela si queda algo sin guardar. */
  const [guardado, setGuardado] = useState<WhatsappSettings>(WHATSAPP_POR_OMISION)
  const [ejemplo, setEjemplo] = useState<Product | null>(null)

  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [errorNumero, setErrorNumero] = useState<string | null>(null)
  const [erroresPlantilla, setErroresPlantilla] = useState<
    Partial<Record<ClavePlantilla, string>>
  >({})

  const campoNumero = useRef<HTMLInputElement>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const ajustes = await obtenerWhatsapp()
      setNumero(soloNumero(ajustes.number))
      setPlantillas(ajustes.templates)
      setGuardado(ajustes)

      // El catálogo solo alimenta la vista previa: si falla, la pantalla sigue
      // siendo perfectamente utilizable, así que su error no tumba la carga.
      try {
        const productos = await listarProductos()
        setEjemplo(productos[0] ?? null)
      } catch {
        setEjemplo(null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los datos')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const numeroValido = numero.length === 10
  const enlace = numeroValido ? `https://wa.me/${normalizarWhatsapp(numero)}` : null

  const hayCambios =
    numero !== soloNumero(guardado.number) ||
    PLANTILLAS.some((p) => plantillas[p.clave] !== guardado.templates[p.clave])

  const faltaProducto = !plantillas.product.includes('{producto}')

  const vistaPrevia = useMemo(() => {
    if (!ejemplo) return null
    // Se usa el mismo `rellenar` que arma el mensaje real (src/lib/whatsapp.ts)
    // para que la vista previa no pueda desviarse de lo que recibe el cliente.
    // El {precio} llega con su propio separador —" ($85.000)"— y desaparece
    // entero cuando el producto no tiene precio publicado.
    const precio = ejemplo.price !== null ? ` (${cop(ejemplo.price)})` : ''
    return rellenar(plantillas.product, {
      producto: ejemplo.name,
      plataforma: platformShort(ejemplo.platform),
      precio,
    })
  }, [plantillas.product, ejemplo])

  function editarPlantilla(clave: ClavePlantilla, valor: string) {
    // Se copia y se asigna por clave en vez de usar una propiedad calculada:
    // así TypeScript conserva el tipo exacto de `templates` y no lo ensancha.
    setPlantillas((p) => {
      const siguiente: WhatsappSettings['templates'] = { ...p }
      siguiente[clave] = valor
      return siguiente
    })
    // El error desaparece mientras se corrige, no al reenviar el formulario.
    setErroresPlantilla((e) => {
      if (!e[clave]) return e
      const copia = { ...e }
      delete copia[clave]
      return copia
    })
  }

  async function restablecer() {
    const ok = await confirmar({
      titulo: 'Restablecer los mensajes',
      mensaje:
        'Los ocho mensajes vuelven al texto original de la tienda y se pierde lo que hayas escrito. El número no se toca.',
      confirmar: 'Restablecer',
    })
    if (!ok) return

    setPlantillas(WHATSAPP_POR_OMISION.templates)
    setErroresPlantilla({})
    // No se guarda solo: queda pendiente para poder revisarlo antes de publicar.
    avisos.aviso('Mensajes restablecidos. Pulsa «Guardar cambios» para publicarlos.')
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()

    const limpio = soloNumero(numero)
    if (limpio.length !== 10) {
      setErrorNumero('Escribe los 10 dígitos del número, sin el +57.')
      campoNumero.current?.focus()
      return
    }
    setErrorNumero(null)

    // Un mensaje vacío abriría WhatsApp sin texto y el cliente no sabría qué
    // escribir: se bloquea el guardado antes de que llegue a la tienda.
    const vacios: Partial<Record<ClavePlantilla, string>> = {}
    for (const p of PLANTILLAS) {
      if (!plantillas[p.clave].trim()) vacios[p.clave] = 'Este mensaje no puede quedar vacío.'
    }
    if (Object.keys(vacios).length > 0) {
      setErroresPlantilla(vacios)
      avisos.aviso('Revisa los mensajes marcados: ninguno puede quedar vacío.')
      return
    }
    setErroresPlantilla({})

    setGuardando(true)
    try {
      const nuevo: WhatsappSettings = { number: limpio, templates: plantillas }
      await guardarWhatsapp(nuevo)
      setNumero(limpio)
      setGuardado(nuevo)
      avisos.exito('WhatsApp actualizado.')
    } catch (err) {
      avisos.error(err)
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) return <Cargando />
  if (error) return <ErrorEstado mensaje={error} onReintentar={() => void cargar()} />

  return (
    <form onSubmit={enviar} noValidate>
      <Encabezado
        titulo="WhatsApp"
        descripcion="El número y los mensajes con los que te escriben desde la tienda."
      >
        {hayCambios && (
          <span className="adm-chip-ambar self-center">Cambios sin guardar</span>
        )}
        <BotonGuardar guardando={guardando}>Guardar cambios</BotonGuardar>
      </Encabezado>

      <div className="space-y-5">
        {/* ── Número ────────────────────────────────────────────────────── */}
        <section className="adm-card-pad">
          <h2 className="adm-titulo">Número</h2>
          <p className="adm-sub mt-1">
            A este número llegan todos los mensajes de la tienda: el del encabezado, el
            de cada ficha de producto y el del carrito.
          </p>

          {/* Sin maxLength a propósito: el navegador recortaría un pegado como
              «+57 350 827 1637» a los diez primeros caracteres y `soloNumero`
              ya no vería el indicativo que tiene que quitar. El recorte a diez
              dígitos lo hace `soloNumero` después de limpiar el texto. */}
          <div className="mt-4 max-w-xs">
            <Entrada
              ref={campoNumero}
              label="Número de WhatsApp"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              requerido
              placeholder="3001234567"
              value={numero}
              onChange={(e) => {
                setNumero(soloNumero(e.target.value))
                setErrorNumero(null)
              }}
              ayuda="Solo dígitos, sin indicativo. El +57 se añade solo."
              error={errorNumero ?? undefined}
            />
          </div>

          <p className="mt-3 flex items-start gap-2 text-[12.5px] text-slate-500">
            <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0">
              {enlace ? (
                <>
                  Enlace que abrirá la tienda:{' '}
                  <span className="adm-num break-all font-semibold text-slate-700">
                    {enlace}
                  </span>
                </>
              ) : (
                'Completa los 10 dígitos para ver el enlace que usará la tienda.'
              )}
            </span>
          </p>
        </section>

        {/* ── Mensajes ──────────────────────────────────────────────────── */}
        <section className="adm-card-pad">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="adm-titulo">Mensajes</h2>
              <p className="adm-sub mt-1">
                El texto que aparece ya escrito en WhatsApp al pulsar cada botón. El
                cliente puede cambiarlo antes de enviarlo.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void restablecer()}
              className="adm-btn-fantasma adm-btn-sm"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Restablecer mensajes
            </button>
          </div>

          <div className="mt-5 space-y-6">
            {PLANTILLAS.map((p) => (
              <div key={p.clave}>
                <AreaTexto
                  label={p.titulo}
                  rows={p.clave === 'product' ? 5 : 3}
                  value={plantillas[p.clave]}
                  onChange={(e) => editarPlantilla(p.clave, e.target.value)}
                  ayuda={p.cuando}
                  error={erroresPlantilla[p.clave]}
                />

                {p.clave === 'product' && (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[12px] font-bold uppercase tracking-wide text-slate-500">
                      Huecos que se rellenan solos
                    </p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {HUECOS.map((h) => (
                        <li key={h.hueco}>
                          <span className="adm-chip-azul">
                            <code>{h.hueco}</code>
                            <span className="font-medium text-blue-600">{h.que}</span>
                          </span>
                        </li>
                      ))}
                    </ul>

                    {faltaProducto && (
                      <p
                        className="mt-2.5 flex items-start gap-1.5 text-[12.5px] font-medium text-amber-700"
                        role="status"
                      >
                        <AlertTriangle
                          className="mt-px h-3.5 w-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span>
                          Sin <code>{'{producto}'}</code> el mensaje no dirá qué
                          producto quiere el cliente.
                        </span>
                      </p>
                    )}

                    <p className="mt-4 text-[12px] font-bold uppercase tracking-wide text-slate-500">
                      Vista previa
                    </p>
                    {/* La condición mira al producto, no al texto: una plantilla
                        vacía es un error del formulario, no una falta de datos. */}
                    {ejemplo ? (
                      <>
                        <p className="mt-2 whitespace-pre-wrap rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[13px] leading-relaxed text-slate-700">
                          {vistaPrevia}
                        </p>
                        <p className="mt-2 text-[12px] leading-relaxed text-slate-500">
                          Ejemplo con «{ejemplo.name}», el primer producto de tu
                          catálogo.
                        </p>
                      </>
                    ) : (
                      <p className="mt-2 text-[13px] leading-relaxed text-slate-500">
                        Aún no hay productos en el catálogo para generar esta vista
                        previa.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </form>
  )
}

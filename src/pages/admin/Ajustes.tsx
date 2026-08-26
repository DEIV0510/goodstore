import {
  AlertTriangle,
  Building2,
  Plus,
  Search,
  Share2,
  Truck,
  X,
  type LucideIcon,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { useAvisos } from '@/components/admin/Avisos'
import { SubirUna } from '@/components/admin/Imagenes'
import { useConfirmar } from '@/components/admin/Modal'
import {
  AreaTexto,
  BotonGuardar,
  Cargando,
  Encabezado,
  Entrada,
  ErrorEstado,
  Selector,
} from '@/components/admin/UI'
import { site } from '@/data/site'
import { cop, normalize } from '@/lib/format'
import { AJUSTES_POR_OMISION, guardarAjustes, obtenerAjustes } from '@/services/ajustes'
import type { Settings } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Ajustes de la tienda.
//
// Cuatro bloques que se guardan por separado (guardarAjustes(clave, valor)):
// así un error al escribir el SEO no arrastra los datos de la empresa.
//
// Dos reglas del negocio viven aquí y no se pueden romper desde la interfaz:
//   · no se publica dirección exacta, solo ciudad y departamento;
//   · una red social sin enlace NO se muestra en la tienda. Vacío significa
//     "todavía no existe", nunca "invéntate una cuenta".
// ─────────────────────────────────────────────────────────────────────────────

type Pestana = keyof Settings

const PESTANAS: { clave: Pestana; etiqueta: string; icono: LucideIcon }[] = [
  { clave: 'company', etiqueta: 'Empresa', icono: Building2 },
  { clave: 'socials', etiqueta: 'Contacto y redes', icono: Share2 },
  { clave: 'shipping', etiqueta: 'Envíos', icono: Truck },
  { clave: 'seo', etiqueta: 'SEO', icono: Search },
]

const REDES: { clave: keyof Settings['socials']; etiqueta: string; ejemplo: string }[] = [
  { clave: 'instagram', etiqueta: 'Instagram', ejemplo: 'https://instagram.com/tucuenta' },
  { clave: 'facebook', etiqueta: 'Facebook', ejemplo: 'https://facebook.com/tupagina' },
  { clave: 'tiktok', etiqueta: 'TikTok', ejemplo: 'https://tiktok.com/@tucuenta' },
  { clave: 'youtube', etiqueta: 'YouTube', ejemplo: 'https://youtube.com/@tucanal' },
]

/** Largo con el que Google suele cortar el resumen de un resultado. */
const LARGO_META = 160

/**
 * Convierte lo escrito en un campo numérico opcional. Un input `number` puede
 * entregar cadenas que no son un número ('1e', '--'): eso no es una tarifa, y
 * una tarifa que no existe se guarda como null, nunca como 0.
 */
function numeroOpcional(valor: string): number | null {
  if (valor.trim() === '') return null
  const n = Number(valor)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null
}

export default function Ajustes() {
  const avisos = useAvisos()
  const confirmar = useConfirmar()

  const [ajustes, setAjustes] = useState<Settings>(AJUSTES_POR_OMISION)
  /** Lo último confirmado por el servidor: revela qué bloque quedó sin guardar. */
  const [original, setOriginal] = useState<Settings>(AJUSTES_POR_OMISION)

  const [pestana, setPestana] = useState<Pestana>('company')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState<Pestana | null>(null)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [zonaNueva, setZonaNueva] = useState('')

  const botonesPestana = useRef<(HTMLButtonElement | null)[]>([])

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const datos = await obtenerAjustes()
      setAjustes(datos)
      setOriginal(datos)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los datos')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  // ── Edición ────────────────────────────────────────────────────────────────

  /** Un campo que se está corrigiendo deja de mostrar su error al instante. */
  function limpiarError(campo: string) {
    setErrores((e) => {
      if (!e[campo]) return e
      const copia = { ...e }
      delete copia[campo]
      return copia
    })
  }

  function editarEmpresa(parcial: Partial<Settings['company']>) {
    setAjustes((a) => ({ ...a, company: { ...a.company, ...parcial } }))
    for (const campo of Object.keys(parcial)) limpiarError(`company.${campo}`)
  }

  function editarRed(clave: keyof Settings['socials'], valor: string) {
    setAjustes((a) => {
      const socials: Settings['socials'] = { ...a.socials }
      socials[clave] = valor
      return { ...a, socials }
    })
    limpiarError(`socials.${clave}`)
  }

  function editarEnvios(parcial: Partial<Settings['shipping']>) {
    setAjustes((a) => ({ ...a, shipping: { ...a.shipping, ...parcial } }))
  }

  function editarSeo(parcial: Partial<Settings['seo']>) {
    setAjustes((a) => ({ ...a, seo: { ...a.seo, ...parcial } }))
    for (const campo of Object.keys(parcial)) limpiarError(`seo.${campo}`)
  }

  // ── Guardado ───────────────────────────────────────────────────────────────

  /** Compara contra lo cargado para avisar de cambios pendientes. */
  const sucia = (clave: Pestana) =>
    JSON.stringify(ajustes[clave]) !== JSON.stringify(original[clave])

  async function guardarBloque<K extends Pestana>(clave: K, etiqueta: string) {
    setGuardando(clave)
    try {
      await guardarAjustes(clave, ajustes[clave])
      setOriginal((o) => {
        // La anotación es necesaria: sin ella TypeScript no relaciona
        // `siguiente[clave]` con `ajustes[clave]` al ser `clave` genérica.
        const siguiente: Settings = { ...o }
        siguiente[clave] = ajustes[clave]
        return siguiente
      })
      avisos.exito(`${etiqueta}: cambios guardados.`)
    } catch (err) {
      avisos.error(err)
    } finally {
      setGuardando(null)
    }
  }

  async function enviarEmpresa(e: FormEvent) {
    e.preventDefault()
    if (!ajustes.company.name.trim()) {
      setErrores({ 'company.name': 'Escribe el nombre del negocio.' })
      return
    }
    setErrores({})
    await guardarBloque('company', 'Empresa')
  }

  async function enviarContacto(e: FormEvent) {
    e.preventDefault()

    const nuevos: Record<string, string> = {}
    const correo = ajustes.company.email.trim()
    if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) {
      nuevos['company.email'] = 'Revisa el correo: parece incompleto.'
    }
    for (const red of REDES) {
      const url = ajustes.socials[red.clave].trim()
      if (url && !/^https?:\/\//i.test(url)) {
        nuevos[`socials.${red.clave}`] =
          'Pega la dirección completa del perfil, empezando por https://'
      }
    }
    if (Object.keys(nuevos).length > 0) {
      setErrores(nuevos)
      return
    }
    setErrores({})

    setGuardando('socials')
    try {
      // El correo vive en el bloque `company` del modelo aunque se edite aquí,
      // porque es información de contacto: esta es la única pestaña que guarda
      // dos claves. Si la segunda falla, `original` no se toca y el aviso de
      // "cambios sin guardar" sigue encendido, que es lo honesto.
      //
      // Se publica el correo SOBRE lo último confirmado del bloque `company`,
      // no sobre lo que hay en pantalla: si el usuario dejó a medias la pestaña
      // Empresa (por ejemplo con el nombre en blanco, que allí es obligatorio),
      // guardar aquí no puede publicárselo por la puerta de atrás.
      const empresa = { ...original.company, email: ajustes.company.email }
      await guardarAjustes('socials', ajustes.socials)
      await guardarAjustes('company', empresa)
      setOriginal((o) => ({ ...o, socials: ajustes.socials, company: empresa }))
      avisos.exito('Contacto y redes: cambios guardados.')
    } catch (err) {
      avisos.error(err)
    } finally {
      setGuardando(null)
    }
  }

  async function enviarEnvios(e: FormEvent) {
    e.preventDefault()
    setErrores({})
    await guardarBloque('shipping', 'Envíos')
  }

  async function enviarSeo(e: FormEvent) {
    e.preventDefault()
    if (!ajustes.seo.title.trim()) {
      setErrores({ 'seo.title': 'Escribe el título con el que quieres aparecer.' })
      return
    }
    setErrores({})
    await guardarBloque('seo', 'SEO')
  }

  // ── Zonas de cobertura ─────────────────────────────────────────────────────

  function anadirZona() {
    const zona = zonaNueva.trim()
    if (!zona) return
    // Comparar sin tildes ni mayúsculas evita "Medellin" y "Medellín" a la vez.
    if (ajustes.shipping.coverage.some((z) => normalize(z) === normalize(zona))) {
      avisos.aviso(`«${zona}» ya está en la lista.`)
      setZonaNueva('')
      return
    }
    setAjustes((a) => ({
      ...a,
      shipping: { ...a.shipping, coverage: [...a.shipping.coverage, zona] },
    }))
    setZonaNueva('')
  }

  async function quitarZona(zona: string) {
    const ok = await confirmar({
      titulo: 'Quitar zona de cobertura',
      mensaje: `«${zona}» dejará de aparecer entre las zonas a las que envías. El cambio se publica al guardar la pestaña.`,
      confirmar: 'Quitar',
    })
    if (!ok) return
    // La lista se filtra dentro del actualizador: entre abrir la confirmación y
    // responderla la lista pudo cambiar, y partir de la copia del render la
    // dejaría como estaba antes de preguntar.
    setAjustes((a) => ({
      ...a,
      shipping: { ...a.shipping, coverage: a.shipping.coverage.filter((z) => z !== zona) },
    }))
  }

  // ── Pestañas ───────────────────────────────────────────────────────────────

  function moverPestana(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const paso = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (paso === 0) return
    e.preventDefault()
    // Recorrido circular: es lo que espera quien navega un tablist con teclado.
    const destino = (i + paso + PESTANAS.length) % PESTANAS.length
    setPestana(PESTANAS[destino].clave)
    botonesPestana.current[destino]?.focus()
  }

  if (cargando) return <Cargando />
  if (error) return <ErrorEstado mensaje={error} onReintentar={() => void cargar()} />

  const contactoSucio = sucia('socials') || ajustes.company.email !== original.company.email
  const largoMeta = ajustes.seo.description.length

  return (
    <>
      <Encabezado
        titulo="Ajustes"
        descripcion="Los datos del negocio que la tienda muestra al público."
      />

      {/* Tira de pestañas: se desplaza sola en pantallas estrechas para que la
          página nunca tenga barra horizontal. */}
      <div
        role="tablist"
        aria-label="Secciones de ajustes"
        className="mb-5 flex gap-1 overflow-x-auto border-b border-slate-200"
      >
        {PESTANAS.map((p, i) => {
          const Icono = p.icono
          const activa = pestana === p.clave
          // La pestaña de contacto vigila también el correo, que se guarda en
          // el bloque de empresa aunque se edite allí.
          const pendiente = p.clave === 'socials' ? contactoSucio : sucia(p.clave)
          return (
            <button
              key={p.clave}
              id={`aj-tab-${p.clave}`}
              type="button"
              role="tab"
              aria-selected={activa}
              aria-controls={`aj-panel-${p.clave}`}
              tabIndex={activa ? 0 : -1}
              ref={(el) => {
                botonesPestana.current[i] = el
              }}
              onClick={() => setPestana(p.clave)}
              onKeyDown={(e) => moverPestana(e, i)}
              className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3.5 text-[13.5px] font-semibold transition-colors ${
                activa
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              <Icono className="h-4 w-4" aria-hidden="true" />
              {p.etiqueta}
              {pendiente && (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-amber-500"
                  aria-hidden="true"
                />
              )}
            </button>
          )
        })}
      </div>

      {/* ── EMPRESA ───────────────────────────────────────────────────────── */}
      {pestana === 'company' && (
        <form
          id="aj-panel-company"
          role="tabpanel"
          aria-labelledby="aj-tab-company"
          onSubmit={enviarEmpresa}
          noValidate
          className="adm-card-pad"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="adm-titulo">Empresa</h2>
              <p className="adm-sub mt-1">
                Nombre, identidad y ubicación general del negocio.
              </p>
            </div>
            {sucia('company') && (
              <span className="adm-chip-ambar self-center">Cambios sin guardar</span>
            )}
          </div>

          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <AlertTriangle
              className="mt-px h-4 w-4 shrink-0 text-amber-600"
              aria-hidden="true"
            />
            <p className="text-[12.5px] leading-relaxed text-amber-900">
              El negocio pidió <strong>NO publicar una dirección exacta</strong>. Mantén
              solo la ciudad y el departamento.
            </p>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Entrada
              label="Nombre"
              requerido
              value={ajustes.company.name}
              onChange={(e) => editarEmpresa({ name: e.target.value })}
              error={errores['company.name']}
              ayuda="Se lee en el pie de página y en el aviso de derechos de autor."
            />
            <Entrada
              label="Lema"
              value={ajustes.company.tagline}
              onChange={(e) => editarEmpresa({ tagline: e.target.value })}
              ayuda="Acompaña al nombre en el pie de página."
            />
            <Entrada
              label="Frase de marca"
              value={ajustes.company.claim}
              onChange={(e) => editarEmpresa({ claim: e.target.value })}
              ayuda="Frase corta que resume qué vendes. Se guarda, pero todavía no hay ninguna página de la tienda que la muestre."
            />
            <Selector
              label="Moneda"
              value={ajustes.company.currency}
              onChange={(e) => editarEmpresa({ currency: e.target.value })}
              opciones={[{ valor: 'COP', etiqueta: 'Peso colombiano (COP)' }]}
              ayuda="La tienda opera solo en pesos colombianos."
            />
          </div>

          <div className="mt-4">
            <SubirUna
              url={ajustes.company.logoUrl || null}
              onChange={(u) => editarEmpresa({ logoUrl: u ?? '' })}
              carpeta="marca"
              label="Logo"
              proporcion="aspect-[16/7]"
              ayuda="PNG o SVG con fondo transparente. Se guarda, pero todavía no sustituye al logotipo que la tienda trae incluido."
            />
          </div>

          <div className="mt-4">
            <AreaTexto
              label="Descripción"
              rows={3}
              value={ajustes.company.description}
              onChange={(e) => editarEmpresa({ description: e.target.value })}
              ayuda="Un párrafo sobre el negocio. Se guarda, pero todavía no hay ninguna página de la tienda que lo muestre."
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Entrada
              label="Ciudad"
              value={ajustes.company.city}
              onChange={(e) => editarEmpresa({ city: e.target.value })}
            />
            <Entrada
              label="Departamento"
              value={ajustes.company.region}
              onChange={(e) => editarEmpresa({ region: e.target.value })}
            />
            <Entrada
              label="País"
              value={ajustes.company.country}
              onChange={(e) => editarEmpresa({ country: e.target.value })}
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Entrada
              label="Texto de ubicación"
              value={ajustes.company.locationLabel}
              onChange={(e) => editarEmpresa({ locationLabel: e.target.value })}
              ayuda="Lo que se lee junto al icono de ubicación. Sin calle ni número."
            />
            <Entrada
              label="Texto de envíos"
              value={ajustes.company.shippingLabel}
              onChange={(e) => editarEmpresa({ shippingLabel: e.target.value })}
              ayuda="Frase corta de cobertura para la cabecera y el pie."
            />
          </div>

          <div className="mt-5 flex justify-end">
            <BotonGuardar guardando={guardando === 'company'}>
              Guardar empresa
            </BotonGuardar>
          </div>
        </form>
      )}

      {/* ── CONTACTO Y REDES ──────────────────────────────────────────────── */}
      {pestana === 'socials' && (
        <form
          id="aj-panel-socials"
          role="tabpanel"
          aria-labelledby="aj-tab-socials"
          onSubmit={enviarContacto}
          noValidate
          className="adm-card-pad"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="adm-titulo">Contacto y redes</h2>
              <p className="adm-sub mt-1">
                Por dónde te pueden escribir además de WhatsApp.
              </p>
            </div>
            {contactoSucio && (
              <span className="adm-chip-ambar self-center">Cambios sin guardar</span>
            )}
          </div>

          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-3.5">
            <AlertTriangle
              className="mt-px h-4 w-4 shrink-0 text-amber-600"
              aria-hidden="true"
            />
            <div>
              <p className="text-[13px] font-bold text-amber-900">
                Las redes sociales están pendientes
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-amber-900">
                Un campo vacío <strong>NO</strong> muestra el icono en la tienda: nunca
                se publica una cuenta que no existe.
              </p>
            </div>
          </div>

          <div className="mt-5 max-w-md">
            <Entrada
              label="Email de contacto"
              type="email"
              inputMode="email"
              autoComplete="email"
              spellCheck={false}
              placeholder="contacto@ejemplo.com"
              value={ajustes.company.email}
              onChange={(e) => editarEmpresa({ email: e.target.value })}
              error={errores['company.email']}
              ayuda="Déjalo vacío si el negocio solo atiende por WhatsApp."
            />
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {REDES.map((red) => (
              <Entrada
                key={red.clave}
                label={red.etiqueta}
                type="url"
                inputMode="url"
                spellCheck={false}
                placeholder={red.ejemplo}
                value={ajustes.socials[red.clave]}
                onChange={(e) => editarRed(red.clave, e.target.value)}
                error={errores[`socials.${red.clave}`]}
                ayuda="Pega la dirección completa del perfil."
              />
            ))}
          </div>

          <div className="mt-5 flex justify-end">
            <BotonGuardar guardando={guardando === 'socials'}>
              Guardar contacto
            </BotonGuardar>
          </div>
        </form>
      )}

      {/* ── ENVÍOS ────────────────────────────────────────────────────────── */}
      {pestana === 'shipping' && (
        <form
          id="aj-panel-shipping"
          role="tabpanel"
          aria-labelledby="aj-tab-shipping"
          onSubmit={enviarEnvios}
          noValidate
          className="adm-card-pad"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="adm-titulo">Envíos</h2>
              <p className="adm-sub mt-1">
                Hasta dónde llegas y qué se le puede prometer al cliente.
              </p>
            </div>
            {sucia('shipping') && (
              <span className="adm-chip-ambar self-center">Cambios sin guardar</span>
            )}
          </div>

          {/* Ninguna página pública lee todavía este bloque: la cobertura que se
              anuncia sale del «Texto de envíos» de la pestaña Empresa. Decirlo
              aquí evita que se den por publicadas unas tarifas que no lo están. */}
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <AlertTriangle
              className="mt-px h-4 w-4 shrink-0 text-amber-600"
              aria-hidden="true"
            />
            <p className="text-[12.5px] leading-relaxed text-amber-900">
              Estos datos se guardan para tu referencia. Lo que la tienda anuncia hoy
              sobre envíos es el <strong>«Texto de envíos»</strong> de la pestaña
              Empresa; el costo se sigue confirmando por WhatsApp.
            </p>
          </div>

          <div className="mt-5">
            <label htmlFor="aj-zona" className="adm-label">
              Zonas de cobertura
            </label>
            <div className="flex gap-2">
              <input
                id="aj-zona"
                type="text"
                value={zonaNueva}
                onChange={(e) => setZonaNueva(e.target.value)}
                onKeyDown={(e) => {
                  // Enter añade la zona. Sin preventDefault enviaría el formulario
                  // entero, que es lo último que espera quien escribe una ciudad.
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    anadirZona()
                  }
                }}
                placeholder="Bogotá, Eje Cafetero, Toda Colombia…"
                className="adm-input"
              />
              <button
                type="button"
                onClick={anadirZona}
                disabled={zonaNueva.trim() === ''}
                className="adm-btn-suave shrink-0"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Añadir
              </button>
            </div>
            <p className="adm-ayuda">
              Ciudades, departamentos o zonas a las que sí despachas.
            </p>

            {ajustes.shipping.coverage.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {ajustes.shipping.coverage.map((zona) => (
                  <li
                    key={zona}
                    className="inline-flex min-h-[44px] items-center gap-1 rounded-full border border-slate-200 bg-slate-100 pl-4 pr-1 text-[13px] font-semibold text-slate-700"
                  >
                    {zona}
                    {/* 44 px reales: quitar una zona en el móvil no puede
                        depender de acertarle a un aspa diminuta. */}
                    <button
                      type="button"
                      onClick={() => void quitarZona(zona)}
                      aria-label={`Quitar la zona ${zona}`}
                      className="grid h-11 w-11 place-items-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-alert-600"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[13px] text-slate-500">
                Aún no hay zonas en la lista.
              </p>
            )}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Entrada
              label="Envío gratis desde"
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              placeholder="Sin definir"
              value={ajustes.shipping.freeFrom ?? ''}
              onChange={(e) =>
                editarEnvios({ freeFrom: numeroOpcional(e.target.value) })
              }
              ayuda={`Déjalo vacío si aún no lo has definido: no se inventa una tarifa que no exista.${
                ajustes.shipping.freeFrom !== null
                  ? ` Equivale a ${cop(ajustes.shipping.freeFrom)}.`
                  : ''
              }`}
              className="adm-num"
            />
            <Entrada
              label="Tarifa plana"
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              placeholder="Sin definir"
              value={ajustes.shipping.flatRate ?? ''}
              onChange={(e) =>
                editarEnvios({ flatRate: numeroOpcional(e.target.value) })
              }
              ayuda={`Déjalo vacío si aún no lo has definido: no se inventa una tarifa que no exista.${
                ajustes.shipping.flatRate !== null
                  ? ` Equivale a ${cop(ajustes.shipping.flatRate)}.`
                  : ''
              }`}
              className="adm-num"
            />
          </div>

          <div className="mt-4 max-w-md">
            <Entrada
              label="Transportadora"
              value={ajustes.shipping.carrier}
              onChange={(e) => editarEnvios({ carrier: e.target.value })}
              ayuda="Con quién despachas. Vacío si todavía se decide por pedido."
            />
          </div>

          <div className="mt-4">
            <AreaTexto
              label="Notas"
              rows={3}
              value={ajustes.shipping.notes}
              onChange={(e) => editarEnvios({ notes: e.target.value })}
              ayuda="Aclaración honesta sobre cómo se cobra o se coordina el envío."
            />
          </div>

          <div className="mt-5 flex justify-end">
            <BotonGuardar guardando={guardando === 'shipping'}>
              Guardar envíos
            </BotonGuardar>
          </div>
        </form>
      )}

      {/* ── SEO ───────────────────────────────────────────────────────────── */}
      {pestana === 'seo' && (
        <form
          id="aj-panel-seo"
          role="tabpanel"
          aria-labelledby="aj-tab-seo"
          onSubmit={enviarSeo}
          noValidate
          className="adm-card-pad"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="adm-titulo">SEO</h2>
              <p className="adm-sub mt-1">
                Cómo se presenta la tienda en Google y al compartir el enlace.
              </p>
            </div>
            {sucia('seo') && (
              <span className="adm-chip-ambar self-center">Cambios sin guardar</span>
            )}
          </div>

          <div className="mt-5">
            <Entrada
              label="Título"
              requerido
              value={ajustes.seo.title}
              onChange={(e) => editarSeo({ title: e.target.value })}
              error={errores['seo.title']}
              ayuda="Lo ideal es no pasar de 60 caracteres: Google corta el resto."
            />
          </div>

          <div className="mt-4">
            <AreaTexto
              label="Meta descripción"
              rows={3}
              value={ajustes.seo.description}
              onChange={(e) => editarSeo({ description: e.target.value })}
              ayuda={`${largoMeta} caracteres. Lo habitual es quedarse entre 120 y ${LARGO_META}.`}
            />
            {largoMeta > LARGO_META && (
              <p
                className="mt-1.5 flex items-start gap-1.5 text-[12.5px] font-medium text-amber-700"
                role="status"
              >
                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Pasa de {LARGO_META} caracteres: Google probablemente corte el final.
              </p>
            )}
          </div>

          <div className="mt-4">
            <Entrada
              label="Palabras clave"
              value={ajustes.seo.keywords}
              onChange={(e) => editarSeo({ keywords: e.target.value })}
              ayuda="Sepáralas con comas. Solo términos por los que de verdad vendes. Google ya no las tiene en cuenta: quedan como referencia interna."
            />
          </div>

          <div className="mt-4">
            <SubirUna
              url={ajustes.seo.ogImage || null}
              onChange={(u) => editarSeo({ ogImage: u ?? '' })}
              carpeta="marca"
              label="Imagen para redes (Open Graph)"
              proporcion="aspect-[1200/630]"
              ayuda="1200 × 630 px. Se guarda, pero la miniatura que hoy viaja al pegar el enlace sigue siendo la que trae la tienda."
            />
          </div>

          {/* Vista previa del resultado: colores del propio buscador (azul el
              título, verde la dirección, gris el resumen) para que se reconozca
              de un vistazo. */}
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-[12px] font-bold uppercase tracking-wide text-slate-500">
              Así se vería en Google
            </p>
            <div className="mt-3 max-w-xl rounded-lg bg-white p-3">
              <p className="line-clamp-2 font-display text-[18px] leading-snug text-blue-700">
                {ajustes.seo.title.trim() || 'Sin título'}
              </p>
              <p className="mt-0.5 truncate text-[13px] text-emerald-700">{site.url}</p>
              <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-slate-600">
                {ajustes.seo.description.trim() ||
                  'Sin meta descripción, Google escoge un fragmento cualquiera de la página.'}
              </p>
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <BotonGuardar guardando={guardando === 'seo'}>Guardar SEO</BotonGuardar>
          </div>
        </form>
      )}
    </>
  )
}

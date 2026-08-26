import {
  BadgeCheck,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  ExternalLink,
  Gamepad2,
  HelpCircle,
  ImageOff,
  LayoutTemplate,
  MapPin,
  MessageCircle,
  Package,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Star,
  ToggleRight,
  Trash2,
  Truck,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import {
  AreaTexto,
  BotonGuardar,
  Cargando,
  Encabezado,
  Entrada,
  ErrorEstado,
  EstadoVacio,
  Etiqueta,
  Interruptor,
  Selector,
} from '@/components/admin/UI'
import { Buscador } from '@/components/admin/Tabla'
import { useConfirmar } from '@/components/admin/Modal'
import { useAvisos } from '@/components/admin/Avisos'
import {
  BENEFICIOS_POR_OMISION,
  HERO_POR_OMISION,
  SECCIONES_POR_OMISION,
  guardarContenido,
  obtenerContenido,
} from '@/services/contenido'
import { fijarDestacados, listarProductos } from '@/services/catalogo'
import { normalize, pluralize, priceLabel } from '@/lib/format'
import { platformShort } from '@/data/taxonomy'
import { backendConfigurado } from '@/lib/supabase'
import type { BenefitContent, HeroContent, Product, SectionToggles } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Portada de la tienda.
//
// Cuatro bloques que se editan por separado y se guardan por separado: quien
// solo quiere apagar una sección no debería arriesgarse a pisar los textos del
// hero. Por eso hay una pestaña, un formulario y un estado "guardando" por
// bloque, en vez de un botón único al final de una pantalla larguísima.
// ─────────────────────────────────────────────────────────────────────────────

const PESTANAS = [
  { id: 'hero', texto: 'Cabecera', icono: LayoutTemplate },
  { id: 'beneficios', texto: 'Beneficios', icono: BadgeCheck },
  { id: 'secciones', texto: 'Secciones', icono: ToggleRight },
  { id: 'destacados', texto: 'Destacados', icono: Star },
] as const

type Pestana = (typeof PESTANAS)[number]['id']

/** El hero de la tienda dibuja un abanico de exactamente cinco portadas. */
const PORTADAS_DEL_ABANICO = 5

/** La portada recorta la rejilla de destacados en doce tarjetas. */
const MAXIMO_DESTACADOS = 12

const MINIMO_BENEFICIOS = 1
const MAXIMO_BENEFICIOS = 6

/**
 * Iconos ofrecidos para la franja de beneficios.
 *
 * Se guarda el NOMBRE (como se llama en lucide-react), no el componente: en la
 * base de datos vive un texto y la tienda lo resuelve al pintar.
 */
const ICONOS_BENEFICIO: { valor: string; etiqueta: string; Icono: LucideIcon }[] = [
  { valor: 'Truck', etiqueta: 'Camión — envíos', Icono: Truck },
  { valor: 'Gamepad2', etiqueta: 'Mando — catálogo', Icono: Gamepad2 },
  { valor: 'RefreshCw', etiqueta: 'Flechas — usados y cambios', Icono: RefreshCw },
  { valor: 'MessageCircle', etiqueta: 'Chat — WhatsApp', Icono: MessageCircle },
  { valor: 'ShieldCheck', etiqueta: 'Escudo — garantía', Icono: ShieldCheck },
  { valor: 'Zap', etiqueta: 'Rayo — entrega rápida', Icono: Zap },
  { valor: 'Package', etiqueta: 'Caja — producto sellado', Icono: Package },
  { valor: 'CreditCard', etiqueta: 'Tarjeta — formas de pago', Icono: CreditCard },
  { valor: 'MapPin', etiqueta: 'Ubicación — punto físico', Icono: MapPin },
  { valor: 'Clock', etiqueta: 'Reloj — horarios', Icono: Clock },
]

const iconoPorNombre = new Map(ICONOS_BENEFICIO.map((i) => [i.valor, i.Icono]))

/**
 * Un icono guardado antes y ausente de la lista se cambiaría solo al abrir el
 * `<select>` (se quedaría con la primera opción). Se añade como opción propia
 * para que nadie pierda un icono sin enterarse.
 */
function opcionesIcono(actual: string) {
  const base = ICONOS_BENEFICIO.map(({ valor, etiqueta }) => ({ valor, etiqueta }))
  if (iconoPorNombre.has(actual)) return base
  // Sin opción que case con el valor, el `<select>` enseñaría la primera de la
  // lista mientras el estado sigue diciendo otra cosa: lo que se ve y lo que se
  // guardaría dejarían de coincidir.
  // Lo que no esté en la lista la tienda lo pinta como caja, no lo deja vacío:
  // se dice tal cual para que nadie espere otra cosa.
  if (!actual) return [{ valor: '', etiqueta: 'Sin elegir — se verá la caja' }, ...base]
  return [...base, { valor: actual, etiqueta: `${actual} — guardado antes, se verá la caja` }]
}

/** Los interruptores, con el nombre que se ve en la tienda y qué apagan. */
const BLOQUES: { clave: keyof SectionToggles; nombre: string; explicacion: string }[] = [
  {
    clave: 'destacados',
    nombre: 'Videojuegos destacados',
    explicacion: 'La rejilla de productos marcados como destacados, debajo de la cabecera.',
  },
  {
    clave: 'categorias',
    nombre: 'Explora por categoría',
    explicacion: 'Las tarjetas grandes que llevan al catálogo ya filtrado.',
  },
  {
    clave: 'usados',
    nombre: 'Franja de usados',
    explicacion: 'El bloque de compra, venta y parte de pago de videojuegos usados.',
  },
  {
    clave: 'playstation',
    nombre: 'Fila de PlayStation',
    explicacion: 'El carrusel de juegos para PS5 y PS4.',
  },
  {
    clave: 'nintendo',
    nombre: 'Fila de Nintendo Switch',
    explicacion: 'El carrusel de juegos para Nintendo Switch.',
  },
  {
    clave: 'consolas',
    nombre: 'Consolas y accesorios',
    explicacion: 'El bloque de consolas, mandos y accesorios.',
  },
  {
    clave: 'confianza',
    nombre: 'Franja de confianza',
    explicacion: 'Los motivos para comprar en GOOD GAME, antes del cierre de la página.',
  },
  {
    clave: 'whatsapp',
    nombre: 'Llamado a WhatsApp',
    explicacion: 'La sección que invita a escribir por WhatsApp para comprar o preguntar.',
  },
  {
    clave: 'faq',
    nombre: 'Preguntas frecuentes',
    explicacion: 'El acordeón con las preguntas que se editan en la pantalla Preguntas.',
  },
  {
    clave: 'banner',
    nombre: 'Banner promocional',
    explicacion:
      'La promoción que se arma en la pantalla Banners. Si no hay ninguna activa no se ve nada, aunque esté encendido.',
  },
]

type ErroresHero = Partial<
  Record<'title' | 'primaryLabel' | 'primaryHref' | 'coverSlugs', string>
>

export default function Contenido() {
  const avisos = useAvisos()
  const confirmar = useConfirmar()

  const [pestana, setPestana] = useState<Pestana>('hero')
  const barra = useRef<HTMLDivElement>(null)

  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [hero, setHero] = useState<HeroContent>(HERO_POR_OMISION)
  // Los slugs se editan como texto suelto: si se derivara de la lista ya
  // partida, escribir una coma borraría lo que se está tecleando.
  const [textoPortadas, setTextoPortadas] = useState('')
  const [erroresHero, setErroresHero] = useState<ErroresHero>({})
  const [guardandoHero, setGuardandoHero] = useState(false)

  const [beneficios, setBeneficios] = useState<BenefitContent[]>(BENEFICIOS_POR_OMISION)
  const [erroresBeneficios, setErroresBeneficios] = useState<Record<number, string>>({})
  const [guardandoBeneficios, setGuardandoBeneficios] = useState(false)

  const [secciones, setSecciones] = useState<SectionToggles>(SECCIONES_POR_OMISION)
  const [guardandoSecciones, setGuardandoSecciones] = useState(false)

  const [productos, setProductos] = useState<Product[]>([])
  const [destacados, setDestacados] = useState<Set<string>>(new Set())
  const [busqueda, setBusqueda] = useState('')
  const [soloSeleccionados, setSoloSeleccionados] = useState(false)
  const [guardandoDestacados, setGuardandoDestacados] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      // El catálogo llega completo (también borradores) porque `fijarDestacados`
      // apaga la marca en TODO el catálogo: hay que conocer los destacados que
      // no están publicados para no borrarlos sin querer al guardar.
      const [contenido, catalogo] = await Promise.all([
        obtenerContenido(),
        listarProductos({ incluirNoPublicados: true }),
      ])
      setHero(contenido.hero)
      setTextoPortadas(contenido.hero.coverSlugs.join(', '))
      setBeneficios(contenido.benefits)
      setSecciones(contenido.sections)
      setProductos(catalogo)
      setDestacados(new Set(catalogo.filter((p) => p.featured).map((p) => p.id)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los datos')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  // ── Cabecera ───────────────────────────────────────────────────────────────

  const slugsPortada = useMemo(
    () =>
      textoPortadas
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    [textoPortadas]
  )

  const productoPorSlug = useMemo(
    () => new Map(productos.map((p) => [p.slug, p])),
    [productos]
  )

  // Se comprueba contra el catálogo REAL que acaba de cargarse, no contra el
  // catálogo incluido en el paquete: con la base de datos conectada son listas
  // distintas y validar contra la equivocada marca como rotos slugs que sí
  // existen (y como buenos otros que ya se borraron).
  const portadas = useMemo(
    () =>
      slugsPortada.map((slug) => {
        const producto = productoPorSlug.get(slug)
        return {
          slug,
          nombre: producto?.name ?? '',
          url: producto?.images[0] ?? null,
          existe: Boolean(producto),
          // El abanico de la tienda solo resuelve productos publicados.
          publicado: producto?.status === 'publicado',
        }
      }),
    [slugsPortada, productoPorSlug]
  )

  const portadasRotas = portadas.filter((p) => !p.existe).length
  const portadasSinPublicar = portadas.filter((p) => p.existe && !p.publicado).length

  function cambiarHero(parcial: Partial<HeroContent>) {
    setHero((h) => ({ ...h, ...parcial }))
  }

  function validarHero(): ErroresHero {
    const e: ErroresHero = {}
    if (!hero.title.trim()) e.title = 'Escribe el titular de la portada.'
    if (!hero.primaryLabel.trim()) e.primaryLabel = 'El botón necesita un texto.'
    if (!hero.primaryHref.trim()) e.primaryHref = 'Indica a dónde lleva el botón.'
    // La tienda pinta ese botón con un enlace interno: una dirección completa
    // (https://…) no navegaría, dejaría el botón muerto.
    else if (!hero.primaryHref.trim().startsWith('/')) {
      e.primaryHref =
        'Tiene que ser una ruta de la propia tienda y empezar por «/», por ejemplo /catalogo.'
    }
    if (slugsPortada.length > PORTADAS_DEL_ABANICO) {
      e.coverSlugs = `El abanico solo tiene sitio para ${PORTADAS_DEL_ABANICO} portadas: sobran ${
        slugsPortada.length - PORTADAS_DEL_ABANICO
      }.`
    }
    return e
  }

  async function alGuardarHero(evento: FormEvent) {
    evento.preventDefault()
    const errores = validarHero()
    setErroresHero(errores)
    if (Object.keys(errores).length > 0) return

    setGuardandoHero(true)
    try {
      // Se recortan los espacios de sobra: un « /catalogo » con espacio delante
      // rompe el enlace del botón sin que se vea nada raro en el campo.
      const valor: HeroContent = {
        ...hero,
        title: hero.title.trim(),
        highlight: hero.highlight.trim(),
        subtitle: hero.subtitle.trim(),
        primaryLabel: hero.primaryLabel.trim(),
        primaryHref: hero.primaryHref.trim(),
        secondaryLabel: hero.secondaryLabel.trim(),
        coverSlugs: slugsPortada,
      }
      await guardarContenido('hero', valor)
      // El estado queda idéntico a lo guardado: los slugs ya vienen limpios.
      setHero(valor)
      setTextoPortadas(valor.coverSlugs.join(', '))
      avisos.exito('Se guardó la cabecera de la portada.')
    } catch (e) {
      avisos.error(e)
    } finally {
      setGuardandoHero(false)
    }
  }

  async function restaurarHero() {
    const seguir = await confirmar({
      titulo: 'Restaurar los valores originales',
      mensaje:
        'Se descartan los textos que hayas escrito en esta pestaña y vuelven los originales de la tienda. Nada cambia en la web hasta que pulses Guardar.',
      confirmar: 'Restaurar',
    })
    if (!seguir) return

    setHero(HERO_POR_OMISION)
    setTextoPortadas(HERO_POR_OMISION.coverSlugs.join(', '))
    setErroresHero({})
    avisos.aviso('Volvieron los valores originales. Falta guardar para publicarlos.')
  }

  // ── Beneficios ─────────────────────────────────────────────────────────────

  function cambiarBeneficio(indice: number, parcial: Partial<BenefitContent>) {
    setBeneficios((lista) =>
      lista.map((b, i) => (i === indice ? { ...b, ...parcial } : b))
    )
  }

  function moverBeneficio(indice: number, salto: -1 | 1) {
    const destino = indice + salto
    if (destino < 0 || destino >= beneficios.length) return
    setBeneficios((lista) => {
      const copia = [...lista]
      ;[copia[indice], copia[destino]] = [copia[destino], copia[indice]]
      return copia
    })
    // Los errores se numeran por posición: si no se limpian quedan señalando
    // al beneficio equivocado después de reordenar.
    setErroresBeneficios({})
  }

  function anadirBeneficio() {
    if (beneficios.length >= MAXIMO_BENEFICIOS) return
    setBeneficios((lista) => [...lista, { icon: 'Truck', title: '', description: '' }])
  }

  async function quitarBeneficio(indice: number) {
    if (beneficios.length <= MINIMO_BENEFICIOS) return
    const seguir = await confirmar({
      titulo: 'Quitar el beneficio',
      mensaje: `Se elimina «${beneficios[indice].title || 'sin título'}» de la franja. El cambio se aplica a la tienda cuando guardes.`,
      confirmar: 'Quitar',
    })
    if (!seguir) return
    setBeneficios((lista) => lista.filter((_, i) => i !== indice))
    setErroresBeneficios({})
  }

  async function alGuardarBeneficios(evento: FormEvent) {
    evento.preventDefault()
    const errores: Record<number, string> = {}
    beneficios.forEach((b, i) => {
      if (!b.title.trim()) errores[i] = 'Escribe el título del beneficio.'
    })
    setErroresBeneficios(errores)
    if (Object.keys(errores).length > 0) return

    setGuardandoBeneficios(true)
    try {
      await guardarContenido('benefits', beneficios)
      avisos.exito('Se guardó la franja de beneficios.')
    } catch (e) {
      avisos.error(e)
    } finally {
      setGuardandoBeneficios(false)
    }
  }

  // ── Secciones ──────────────────────────────────────────────────────────────

  async function alGuardarSecciones(evento: FormEvent) {
    evento.preventDefault()
    setGuardandoSecciones(true)
    try {
      await guardarContenido('sections', secciones)
      avisos.exito('Se guardaron las secciones visibles.')
    } catch (e) {
      avisos.error(e)
    } finally {
      setGuardandoSecciones(false)
    }
  }

  // ── Destacados ─────────────────────────────────────────────────────────────

  const publicados = useMemo(
    () => productos.filter((p) => p.status === 'publicado'),
    [productos]
  )

  const listaDestacados = useMemo(() => {
    const consulta = normalize(busqueda)
    return publicados.filter((p) => {
      if (soloSeleccionados && !destacados.has(p.id)) return false
      if (!consulta) return true
      return normalize(p.name).includes(consulta) || normalize(p.slug).includes(consulta)
    })
  }, [publicados, busqueda, soloSeleccionados, destacados])

  const seleccionadosPublicados = publicados.filter((p) => destacados.has(p.id)).length
  // Un borrador destacado no se ve en la tienda, pero sigue marcado en la base
  // de datos y se conserva al guardar. Se avisa para que la cuenta cuadre.
  const seleccionadosOcultos = destacados.size - seleccionadosPublicados

  function alternarDestacado(id: string) {
    setDestacados((antes) => {
      const copia = new Set(antes)
      if (copia.has(id)) copia.delete(id)
      else copia.add(id)
      return copia
    })
  }

  async function alGuardarDestacados(evento: FormEvent) {
    evento.preventDefault()
    const ids = [...destacados]
    const marcados = new Set(ids)

    // Guardar sin nada marcado vacía la rejilla de la portada, y eso se hace
    // muy fácil sin querer después de filtrar la lista: se pregunta antes. Se
    // mira solo lo publicado, que es lo único que la portada enseña: quedarse
    // con destacados que son borradores deja la rejilla igual de vacía.
    const vaciaLaRejilla =
      seleccionadosPublicados === 0 &&
      productos.some((p) => p.featured && p.status === 'publicado')
    if (vaciaLaRejilla) {
      const seguir = await confirmar({
        titulo: 'Quitar todos los destacados',
        mensaje:
          'La rejilla de destacados de la portada quedará vacía. Los productos siguen en el catálogo y puedes volver a marcarlos cuando quieras.',
        confirmar: 'Quitar todos',
      })
      if (!seguir) return
    }

    setGuardandoDestacados(true)
    try {
      await fijarDestacados(ids)
      // La lista en memoria se pone al día para que la cuenta no mienta si se
      // vuelve a guardar sin recargar la pantalla. Se usa la foto que se envió
      // (`marcados`), no el estado actual: si alguien marcó otra casilla
      // mientras se guardaba, ese cambio todavía no está en la base de datos.
      setProductos((lista) => lista.map((p) => ({ ...p, featured: marcados.has(p.id) })))
      avisos.exito(
        `Se marcaron ${pluralize(ids.length, 'producto destacado', 'productos destacados')}.`
      )
    } catch (e) {
      avisos.error(e)
    } finally {
      setGuardandoDestacados(false)
    }
  }

  // ── Pestañas ───────────────────────────────────────────────────────────────

  /** Flechas, Inicio y Fin mueven entre pestañas, como manda el patrón ARIA. */
  function navegarPestanas(evento: KeyboardEvent<HTMLDivElement>) {
    const actual = PESTANAS.findIndex((p) => p.id === pestana)
    let destino = -1
    if (evento.key === 'ArrowRight') destino = (actual + 1) % PESTANAS.length
    else if (evento.key === 'ArrowLeft')
      destino = (actual - 1 + PESTANAS.length) % PESTANAS.length
    else if (evento.key === 'Home') destino = 0
    else if (evento.key === 'End') destino = PESTANAS.length - 1
    if (destino < 0) return

    evento.preventDefault()
    const siguiente = PESTANAS[destino].id
    setPestana(siguiente)
    barra.current?.querySelector<HTMLElement>(`#pestana-${siguiente}`)?.focus()
  }

  if (cargando) return <Cargando texto="Cargando el contenido de la portada…" />
  if (error) return <ErrorEstado mensaje={error} onReintentar={() => void cargar()} />

  return (
    <>
      <Encabezado
        titulo="Portada"
        descripcion="Los textos, los bloques y los productos que ve quien entra a la tienda. Cada pestaña se guarda por separado."
      >
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Ver la tienda (se abre en una pestaña nueva)"
          className="adm-btn-suave adm-btn-sm"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          Ver la tienda
        </a>
      </Encabezado>

      {!backendConfigurado && (
        <p className="adm-card mb-5 flex items-start gap-2.5 border-amber-200 bg-amber-50 p-3.5 text-[13px] leading-relaxed text-amber-800">
          <HelpCircle className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            La base de datos no está conectada: aquí ves el contenido que trae la tienda
            hoy y puedes prepararlo, pero al pulsar Guardar el panel avisará de que no hay
            dónde guardarlo.
          </span>
        </p>
      )}

      {/* ── Barra de pestañas ─────────────────────────────────────────────── */}
      <div
        ref={barra}
        role="tablist"
        aria-label="Bloques de la portada"
        onKeyDown={navegarPestanas}
        className="adm-card mb-5 flex gap-1 overflow-x-auto p-1.5"
      >
        {PESTANAS.map(({ id, texto, icono: Icono }) => {
          const activa = pestana === id
          return (
            <button
              key={id}
              id={`pestana-${id}`}
              type="button"
              role="tab"
              aria-selected={activa}
              aria-controls={`panel-${id}`}
              // Roving tabindex: el tabulador entra una sola vez a la barra y
              // dentro se navega con las flechas.
              tabIndex={activa ? 0 : -1}
              onClick={() => setPestana(id)}
              className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-lg px-3.5 text-[13px] font-semibold transition-colors sm:min-h-[40px] ${
                activa
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icono className="h-4 w-4" aria-hidden="true" />
              {texto}
            </button>
          )
        })}
      </div>

      {/* ══ CABECERA ═══════════════════════════════════════════════════════ */}
      {pestana === 'hero' && (
        <form
          id="panel-hero"
          role="tabpanel"
          aria-labelledby="pestana-hero"
          onSubmit={alGuardarHero}
          className="adm-card-pad"
        >
          <h2 className="adm-titulo">Cabecera de la portada</h2>
          <p className="adm-sub mt-1">
            El primer bloque de la tienda: el titular, la frase de apoyo, los dos botones y
            el abanico de portadas.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Entrada
              label="Título"
              requerido
              value={hero.title}
              onChange={(e) => cambiarHero({ title: e.target.value })}
              error={erroresHero.title}
              maxLength={70}
            />
            <Entrada
              label="Texto resaltado"
              value={hero.highlight}
              onChange={(e) => cambiarHero({ highlight: e.target.value })}
              ayuda="Se pinta en amarillo justo después del título."
              maxLength={40}
            />
          </div>

          <div className="mt-4">
            <AreaTexto
              label="Subtítulo"
              value={hero.subtitle}
              onChange={(e) => cambiarHero({ subtitle: e.target.value })}
              rows={3}
              maxLength={200}
              ayuda="Una frase corta explicando qué se vende. Se lee debajo del título."
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Entrada
              label="Etiqueta del botón principal"
              requerido
              value={hero.primaryLabel}
              onChange={(e) => cambiarHero({ primaryLabel: e.target.value })}
              error={erroresHero.primaryLabel}
              maxLength={30}
            />
            <Entrada
              label="Enlace del botón principal"
              requerido
              value={hero.primaryHref}
              onChange={(e) => cambiarHero({ primaryHref: e.target.value })}
              error={erroresHero.primaryHref}
              ayuda="Ruta dentro de la tienda, por ejemplo /catalogo"
            />
            <Entrada
              label="Etiqueta del botón de WhatsApp"
              value={hero.secondaryLabel}
              onChange={(e) => cambiarHero({ secondaryLabel: e.target.value })}
              ayuda="El número y el mensaje se configuran en la pantalla WhatsApp."
              maxLength={30}
            />
          </div>

          {/* ── Portadas del abanico ──────────────────────────────────────── */}
          <div className="mt-6 border-t border-slate-200 pt-5">
            <Entrada
              label="Portadas del abanico"
              value={textoPortadas}
              onChange={(e) => setTextoPortadas(e.target.value)}
              error={erroresHero.coverSlugs}
              ayuda={`${PORTADAS_DEL_ABANICO} slugs separados por comas. El slug es la parte final de la dirección del producto: /producto/elden-ring-ps5 → elden-ring-ps5`}
            />

            {portadas.length > 0 && (
              <>
                <p className="mt-4 text-[12.5px] font-semibold uppercase tracking-wide text-slate-500">
                  Vista previa
                </p>
                <ul className="mt-2 flex flex-wrap gap-3">
                  {portadas.map(({ slug, nombre, url, existe, publicado }, i) => (
                    <li key={`${slug}-${i}`} className="w-[92px]">
                      {!existe ? (
                        // El aviso hablado lo da el resumen de más abajo una sola
                        // vez; marcar cada miniatura como alerta repetiría el
                        // mensaje en cada tecla que se pulsa.
                        <span className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-alert-500 bg-red-50 px-1 text-center text-alert-600">
                          <ImageOff className="h-5 w-5" aria-hidden="true" />
                          <span className="text-[10.5px] font-bold leading-tight">
                            No existe
                          </span>
                        </span>
                      ) : url ? (
                        <img
                          src={url}
                          alt={`Portada de ${nombre || slug}`}
                          loading="lazy"
                          className={`aspect-[3/4] w-full rounded-lg border border-slate-200 object-cover ${
                            publicado ? '' : 'opacity-45'
                          }`}
                        />
                      ) : (
                        // El producto existe pero no tiene foto: la tienda pinta
                        // una portada de marca con el título, no un hueco.
                        <span className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-1 text-center text-slate-400">
                          <ImageOff className="h-5 w-5" aria-hidden="true" />
                          <span className="text-[10.5px] font-bold leading-tight">
                            Sin foto
                          </span>
                        </span>
                      )}
                      <span
                        className={`mt-1.5 block break-words text-[10.5px] leading-tight ${
                          existe ? 'text-slate-500' : 'font-bold text-alert-600'
                        }`}
                      >
                        {nombre || slug}
                        {existe && !publicado && (
                          <span className="mt-0.5 block font-bold text-amber-600">
                            Sin publicar
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {portadasRotas > 0 && (
              <p className="adm-error" role="alert">
                {pluralize(portadasRotas, 'slug no corresponde', 'slugs no corresponden')} a
                ningún producto del catálogo: revisa cómo están escritos, porque esas
                portadas no se pintarán.
              </p>
            )}
            {portadasSinPublicar > 0 && (
              <p className="adm-ayuda">
                {pluralize(
                  portadasSinPublicar,
                  'portada apunta a un producto sin publicar',
                  'portadas apuntan a productos sin publicar'
                )}
                : el abanico de la tienda se los salta hasta que los publiques.
              </p>
            )}
            {portadasRotas === 0 && slugsPortada.length < PORTADAS_DEL_ABANICO && (
              <p className="adm-ayuda">
                {PORTADAS_DEL_ABANICO - slugsPortada.length === 1
                  ? 'Falta 1 portada'
                  : `Faltan ${PORTADAS_DEL_ABANICO - slugsPortada.length} portadas`}{' '}
                para completar el abanico; los huecos quedarán vacíos.
              </p>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4">
            <BotonGuardar guardando={guardandoHero}>Guardar cabecera</BotonGuardar>
            <button
              type="button"
              onClick={() => void restaurarHero()}
              className="adm-btn-suave adm-btn-sm"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Restaurar valores originales
            </button>
          </div>
        </form>
      )}

      {/* ══ BENEFICIOS ═════════════════════════════════════════════════════ */}
      {pestana === 'beneficios' && (
        <form
          id="panel-beneficios"
          role="tabpanel"
          aria-labelledby="pestana-beneficios"
          onSubmit={alGuardarBeneficios}
        >
          <div className="adm-card-pad">
            <h2 className="adm-titulo">Franja de beneficios</h2>
            <p className="adm-sub mt-1">
              La tira que va justo debajo de la cabecera. La rejilla está pensada para
              cuatro: con cinco o seis la última fila queda coja.
            </p>
          </div>

          <ul className="mt-4 space-y-4">
            {beneficios.map((beneficio, i) => {
              // El mismo repuesto que usa la tienda (`Benefits.tsx`) para un
              // nombre que no reconoce: así la vista previa no promete un icono
              // distinto del que se va a ver.
              const Icono = iconoPorNombre.get(beneficio.icon) ?? Package
              return (
                <li key={i} className="adm-card-pad">
                  <div className="flex items-center gap-3">
                    <span
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700"
                      aria-hidden="true"
                    >
                      <Icono className="h-[18px] w-[18px]" />
                    </span>
                    <p className="min-w-0 flex-1 font-display text-[14px] font-bold text-slate-900">
                      Beneficio {i + 1}
                      <span className="ml-2 font-sans text-[12px] font-medium text-slate-400">
                        de {beneficios.length}
                      </span>
                    </p>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moverBeneficio(i, -1)}
                        disabled={i === 0}
                        aria-label={`Subir el beneficio ${i + 1}`}
                        className="adm-icono h-11 w-11 disabled:pointer-events-none disabled:opacity-35 sm:h-9 sm:w-9"
                      >
                        <ChevronUp className="h-[18px] w-[18px]" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moverBeneficio(i, 1)}
                        disabled={i === beneficios.length - 1}
                        aria-label={`Bajar el beneficio ${i + 1}`}
                        className="adm-icono h-11 w-11 disabled:pointer-events-none disabled:opacity-35 sm:h-9 sm:w-9"
                      >
                        <ChevronDown className="h-[18px] w-[18px]" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void quitarBeneficio(i)}
                        disabled={beneficios.length <= MINIMO_BENEFICIOS}
                        aria-label={`Quitar el beneficio ${i + 1}`}
                        className="adm-icono h-11 w-11 text-alert-500 hover:bg-red-50 hover:text-alert-600 disabled:pointer-events-none disabled:opacity-35 sm:h-9 sm:w-9"
                      >
                        <Trash2 className="h-[18px] w-[18px]" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-3">
                    <Selector
                      label="Icono"
                      value={beneficio.icon}
                      onChange={(e) => cambiarBeneficio(i, { icon: e.target.value })}
                      opciones={opcionesIcono(beneficio.icon)}
                    />
                    <Entrada
                      label="Título"
                      requerido
                      value={beneficio.title}
                      onChange={(e) => cambiarBeneficio(i, { title: e.target.value })}
                      error={erroresBeneficios[i]}
                      maxLength={40}
                    />
                    <Entrada
                      label="Descripción"
                      value={beneficio.description}
                      onChange={(e) => cambiarBeneficio(i, { description: e.target.value })}
                      maxLength={60}
                    />
                  </div>
                </li>
              )
            })}
          </ul>

          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <button
              type="button"
              onClick={anadirBeneficio}
              disabled={beneficios.length >= MAXIMO_BENEFICIOS}
              className="adm-btn-suave adm-btn-sm"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Añadir beneficio
            </button>
            <p className="adm-sub">
              {beneficios.length >= MAXIMO_BENEFICIOS
                ? `Máximo ${MAXIMO_BENEFICIOS}. Quita uno para poder añadir otro.`
                : `Puedes tener entre ${MINIMO_BENEFICIOS} y ${MAXIMO_BENEFICIOS}.`}
            </p>
          </div>

          <div className="mt-4">
            <BotonGuardar guardando={guardandoBeneficios}>Guardar beneficios</BotonGuardar>
          </div>
        </form>
      )}

      {/* ══ SECCIONES ══════════════════════════════════════════════════════ */}
      {pestana === 'secciones' && (
        <form
          id="panel-secciones"
          role="tabpanel"
          aria-labelledby="pestana-secciones"
          onSubmit={alGuardarSecciones}
        >
          <div className="adm-card">
            <div className="border-b border-slate-200 p-4 sm:p-5">
              <h2 className="adm-titulo">Secciones de la portada</h2>
              <p className="adm-sub mt-1">
                Apaga un bloque y desaparece de la tienda sin borrar nada: los productos,
                las categorías y las preguntas siguen donde están. La cabecera y la franja
                de beneficios se muestran siempre.
              </p>
            </div>

            <ul className="divide-y divide-slate-100">
              {BLOQUES.map(({ clave, nombre, explicacion }) => (
                <li key={clave} className="px-4 py-3.5 sm:px-5">
                  <Interruptor
                    activo={secciones[clave]}
                    onChange={(v) => setSecciones((s) => ({ ...s, [clave]: v }))}
                    label={nombre}
                    descripcion={explicacion}
                  />
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4">
            <BotonGuardar guardando={guardandoSecciones}>Guardar secciones</BotonGuardar>
          </div>
        </form>
      )}

      {/* ══ DESTACADOS ═════════════════════════════════════════════════════ */}
      {pestana === 'destacados' && (
        <form
          id="panel-destacados"
          role="tabpanel"
          aria-labelledby="pestana-destacados"
          onSubmit={alGuardarDestacados}
        >
          <div className="adm-card">
            <div className="border-b border-slate-200 p-4 sm:p-5">
              <h2 className="adm-titulo">Videojuegos destacados</h2>
              <p className="adm-sub mt-1">
                Marca los productos que aparecen en la rejilla de la portada. Solo se
                pueden destacar productos publicados.
              </p>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Buscador
                  valor={busqueda}
                  onChange={setBusqueda}
                  etiqueta="Buscar producto por nombre o slug"
                  placeholder="Buscar producto…"
                />
                <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 text-[13px] font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={soloSeleccionados}
                    onChange={(e) => setSoloSeleccionados(e.target.checked)}
                    className="h-[18px] w-[18px] accent-blue-600"
                  />
                  Ver solo los seleccionados
                </label>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Etiqueta tono={seleccionadosPublicados > MAXIMO_DESTACADOS ? 'ambar' : 'azul'}>
                  <span className="adm-num">{seleccionadosPublicados}</span>
                  <span>
                    {seleccionadosPublicados === 1 ? 'seleccionado' : 'seleccionados'}
                  </span>
                </Etiqueta>
                <span className="adm-sub">
                  de {pluralize(publicados.length, 'producto publicado', 'productos publicados')}
                </span>
              </div>

              {seleccionadosPublicados > MAXIMO_DESTACADOS && (
                <p className="adm-error" role="alert">
                  La portada muestra como máximo {MAXIMO_DESTACADOS}: los demás quedarán
                  marcados pero no se verán ahí.
                </p>
              )}

              {seleccionadosOcultos > 0 && (
                <p className="adm-ayuda">
                  Además hay{' '}
                  {pluralize(
                    seleccionadosOcultos,
                    'producto destacado sin publicar',
                    'productos destacados sin publicar'
                  )}
                  . No se ven en la tienda ni en esta lista, y se conservan tal cual al
                  guardar.
                </p>
              )}
            </div>

            {publicados.length === 0 ? (
              <EstadoVacio
                icono={Star}
                titulo="Todavía no hay productos publicados"
                descripcion="Publica productos desde la pantalla Productos y podrás elegir cuáles destacar en la portada."
              />
            ) : listaDestacados.length === 0 ? (
              <EstadoVacio
                icono={Star}
                titulo="Ningún producto coincide"
                descripcion="Prueba con otro texto o quita el filtro de seleccionados."
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {listaDestacados.map((p) => {
                  const marcado = destacados.has(p.id)
                  return (
                    <li key={p.id}>
                      <label
                        className={`flex min-h-[56px] cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-slate-50 ${
                          marcado ? 'bg-blue-50/60' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={marcado}
                          onChange={() => alternarDestacado(p.id)}
                          className="h-[18px] w-[18px] shrink-0 accent-blue-600"
                        />
                        {p.images[0] ? (
                          <img
                            src={p.images[0]}
                            alt=""
                            loading="lazy"
                            className="h-12 w-9 shrink-0 rounded border border-slate-200 object-cover"
                          />
                        ) : (
                          <span
                            className="grid h-12 w-9 shrink-0 place-items-center rounded border border-slate-200 bg-slate-100 text-slate-400"
                            aria-hidden="true"
                          >
                            <ImageOff className="h-4 w-4" />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-semibold text-slate-800">
                            {p.name}
                          </span>
                          <span className="mt-0.5 block truncate text-[12px] text-slate-400">
                            {p.slug}
                          </span>
                        </span>
                        <span className="hidden shrink-0 sm:block">
                          <Etiqueta tono="gris">{platformShort(p.platform)}</Etiqueta>
                        </span>
                        <span className="adm-num shrink-0 text-right text-[13px] font-semibold text-slate-700">
                          {priceLabel(p.price)}
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="mt-4">
            <BotonGuardar guardando={guardandoDestacados}>Guardar destacados</BotonGuardar>
          </div>
        </form>
      )}
    </>
  )
}

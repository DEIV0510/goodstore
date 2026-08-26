import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { cliente, backendConfigurado } from '@/lib/supabase'
import {
  catalogoDeRespaldo,
  categoriasDeRespaldo,
  listarCategorias,
  listarProductos,
} from '@/services/catalogo'
import {
  CONTENIDO_POR_OMISION,
  faqDeRespaldo,
  listarBanners,
  listarFaq,
  obtenerContenido,
} from '@/services/contenido'
import {
  AJUSTES_POR_OMISION,
  WHATSAPP_POR_OMISION,
  obtenerAjustes,
  obtenerWhatsapp,
} from '@/services/ajustes'
import { configurarSitio } from '@/data/site'
import type {
  Banner,
  CategoryCard,
  FaqItem,
  Product,
  Settings,
  SiteContent,
  WhatsappSettings,
} from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Datos de la tienda pública.
//
// Este proveedor es lo que hace que el panel y la tienda compartan una sola
// fuente: la tienda no lee ficheros del proyecto, lee lo mismo que edita el
// administrador. Si cambia un precio en /admin, aquí llega ese precio.
//
// Sin base de datos conectada devuelve el catálogo incluido en el paquete —el
// que hoy está publicado— y lo hace de forma síncrona, para que la tienda no
// muestre un instante en blanco.
// ─────────────────────────────────────────────────────────────────────────────

interface ValorCatalogo {
  productos: Product[]
  categorias: CategoryCard[]
  faq: FaqItem[]
  banners: Banner[]
  contenido: SiteContent
  ajustes: Settings
  whatsapp: WhatsappSettings
  cargando: boolean
  error: string | null
  recargar: () => Promise<void>
  /** Producto por slug, sin recorrer el array en cada llamada. */
  porSlug: (slug: string) => Product | undefined
}

const CatalogoContext = createContext<ValorCatalogo | null>(null)

/** Cuánto se espera a la base de datos antes de tirar del catálogo de respaldo. */
const ESPERA_MAXIMA = 3500

export function CatalogoProvider({ children }: { children: ReactNode }) {
  const [productos, setProductos] = useState<Product[]>([])
  const [categorias, setCategorias] = useState<CategoryCard[]>([])
  const [faq, setFaq] = useState<FaqItem[]>([])
  const [banners, setBanners] = useState<Banner[]>([])
  const [contenido, setContenido] = useState<SiteContent>(CONTENIDO_POR_OMISION)
  const [ajustes, setAjustes] = useState<Settings>(AJUSTES_POR_OMISION)
  const [whatsapp, setWhatsapp] = useState<WhatsappSettings>(WHATSAPP_POR_OMISION)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setError(null)

    // Reloj de paciencia.
    //
    // Cuando la base de datos no contesta, su cliente reintenta varias veces
    // antes de rendirse: medido, tarda unos 8,4 segundos en lanzar el error.
    // Ocho segundos de tienda en blanco es una venta perdida, así que a los
    // 3,5 se pinta el catálogo de respaldo sin esperar más. Si los datos
    // reales llegan después, se sustituyen y el visitante no nota nada.
    //
    // En una conexión normal la base responde en menos de medio segundo y
    // este reloj no llega a saltar nunca.
    const reloj = window.setTimeout(() => {
      setProductos((a) => (a.length > 0 ? a : catalogoDeRespaldo()))
      setCategorias((a) => (a.length > 0 ? a : categoriasDeRespaldo()))
      setFaq((a) => (a.length > 0 ? a : faqDeRespaldo()))
      setCargando(false)
    }, ESPERA_MAXIMA)

    try {
      const [p, c, f, b, ct, aj, wa] = await Promise.all([
        listarProductos(),
        listarCategorias(),
        listarFaq(),
        listarBanners(),
        obtenerContenido(),
        obtenerAjustes(),
        obtenerWhatsapp(),
      ])
      // Una base de datos que responde bien pero devuelve CERO productos casi
      // siempre significa "todavía no se ha cargado el catálogo", no "el
      // negocio archivó sus 318 productos". Se prefiere mostrar el catálogo
      // publicado antes que un escaparate vacío al cliente.
      setProductos(p.length > 0 ? p : catalogoDeRespaldo())
      setCategorias(c.length > 0 ? c : categoriasDeRespaldo())
      setFaq(f.length > 0 ? f : faqDeRespaldo())
      setBanners(b)
      setContenido(ct)
      setAjustes(aj)
      setWhatsapp(wa)

      // Vuelca la configuración sobre `site` y `MESSAGES`, que es de donde leen
      // el encabezado, el pie y los botones de WhatsApp repartidos por la
      // tienda. Va después de los setState: el repintado que provocan es lo que
      // hace que esos componentes tomen los valores nuevos.
      configurarSitio(aj, wa)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el catálogo')

      // La tienda NUNCA se queda en blanco. Si la base de datos no responde
      // —red caída, credencial caducada, proyecto en pausa— se muestra el
      // catálogo que viene con la última versión publicada del sitio.
      //
      // Solo se rellena lo que esté vacío: si el fallo ocurre al recargar
      // (por ejemplo tras un cambio en tiempo real), lo que ya se estaba
      // mostrando es más reciente que el respaldo y se conserva.
      setProductos((actuales) =>
        actuales.length > 0 ? actuales : catalogoDeRespaldo()
      )
      setCategorias((actuales) =>
        actuales.length > 0 ? actuales : categoriasDeRespaldo()
      )
      setFaq((actuales) => (actuales.length > 0 ? actuales : faqDeRespaldo()))
    } finally {
      window.clearTimeout(reloj)
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  // Con base de datos conectada, la tienda se entera de los cambios del panel
  // sin recargar la página.
  useEffect(() => {
    if (!backendConfigurado) return

    let vivo = true
    let cerrar: (() => void) | undefined

    void (async () => {
      const db = await cliente()
      if (!db || !vivo) return

      // Un solo canal para todas las tablas que afectan a lo que se ve en la
      // tienda: abrir uno por tabla multiplicaría las conexiones sin ganar nada.
      let canal = db.channel('gg-tienda')
      for (const tabla of ['products', 'categories', 'banners', 'faq', 'site_content']) {
        canal = canal.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: tabla },
          () => void cargar()
        )
      }
      canal.subscribe()

      cerrar = () => void db.removeChannel(canal)
    })()

    return () => {
      vivo = false
      cerrar?.()
    }
  }, [cargar])

  const indice = useMemo(
    () => new Map(productos.map((p) => [p.slug, p])),
    [productos]
  )
  const porSlug = useCallback((slug: string) => indice.get(slug), [indice])

  const valor = useMemo<ValorCatalogo>(
    () => ({
      productos,
      categorias,
      faq,
      banners,
      contenido,
      ajustes,
      whatsapp,
      cargando,
      error,
      recargar: cargar,
      porSlug,
    }),
    [
      productos,
      categorias,
      faq,
      banners,
      contenido,
      ajustes,
      whatsapp,
      cargando,
      error,
      cargar,
      porSlug,
    ]
  )

  return <CatalogoContext.Provider value={valor}>{children}</CatalogoContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCatalogo() {
  const ctx = useContext(CatalogoContext)
  if (!ctx) throw new Error('useCatalogo debe usarse dentro de <CatalogoProvider>')
  return ctx
}

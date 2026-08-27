import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api } from '@/lib/api'
import { catalogoDeRespaldo, categoriasDeRespaldo } from '@/services/catalogo'
import {
  CONTENIDO_POR_OMISION,
  faqDeRespaldo,
  fusionarContenido,
} from '@/services/contenido'
import {
  AJUSTES_POR_OMISION,
  WHATSAPP_POR_OMISION,
  fusionarAjustes,
  fusionarWhatsapp,
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
// Todo se pide en UNA sola petición a /api/publico. Siete peticiones separadas
// significarían siete viajes de ida y vuelta antes de que el cliente vea un
// producto, y en móvil con datos eso se nota mucho.
// ─────────────────────────────────────────────────────────────────────────────

interface RespuestaPublica {
  productos: Product[]
  categorias: CategoryCard[]
  preguntas: FaqItem[]
  banners: Banner[]
  contenido: Record<string, unknown>
  ajustes: Record<string, unknown>
  whatsapp: Record<string, unknown>
}

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

/** Cuánto se espera al servidor antes de tirar del catálogo de respaldo. */
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

  /** Rellena solo lo que esté vacío, para no pisar datos ya cargados. */
  const usarRespaldo = useCallback(() => {
    setProductos((a) => (a.length > 0 ? a : catalogoDeRespaldo()))
    setCategorias((a) => (a.length > 0 ? a : categoriasDeRespaldo()))
    setFaq((a) => (a.length > 0 ? a : faqDeRespaldo()))
  }, [])

  const cargar = useCallback(async () => {
    setError(null)

    // Reloj de paciencia. Si el servidor tarda, se pinta el catálogo publicado
    // con la última versión del sitio en vez de dejar la tienda en blanco. Si
    // los datos reales llegan después, se sustituyen y no se nota nada.
    const reloj = window.setTimeout(() => {
      usarRespaldo()
      setCargando(false)
    }, ESPERA_MAXIMA)

    try {
      const r = await api<RespuestaPublica>('publico')

      // Un servidor que responde bien pero devuelve cero productos casi siempre
      // significa "la base todavía no se ha llenado", no "el negocio archivó
      // sus 318 productos". Se prefiere el catálogo publicado a un escaparate
      // vacío delante del cliente.
      setProductos(r.productos.length > 0 ? r.productos : catalogoDeRespaldo())
      setCategorias(r.categorias.length > 0 ? r.categorias : categoriasDeRespaldo())
      setFaq(r.preguntas.length > 0 ? r.preguntas : faqDeRespaldo())
      setBanners(r.banners)

      const ct = fusionarContenido(r.contenido ?? {})
      const aj = fusionarAjustes(r.ajustes ?? {})
      const wa = fusionarWhatsapp(r.whatsapp ?? {})
      setContenido(ct)
      setAjustes(aj)
      setWhatsapp(wa)

      // Vuelca la configuración sobre `site` y `MESSAGES`, que es de donde leen
      // el encabezado, el pie y los botones de WhatsApp repartidos por la
      // tienda. Va después de los setState: el repintado que provocan es lo
      // que hace que esos componentes tomen los valores nuevos.
      configurarSitio(aj, wa)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el catálogo')
      usarRespaldo()
    } finally {
      window.clearTimeout(reloj)
      setCargando(false)
    }
  }, [usarRespaldo])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const indice = useMemo(() => new Map(productos.map((p) => [p.slug, p])), [productos])
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

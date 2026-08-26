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
import { listarCategorias, listarProductos } from '@/services/catalogo'
import {
  CONTENIDO_POR_OMISION,
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
      setProductos(p)
      setCategorias(c)
      setFaq(f)
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
      // La tienda no puede quedarse en blanco por un fallo de red: se avisa,
      // pero se sigue mostrando lo último que se pudo cargar.
      setError(e instanceof Error ? e.message : 'No se pudo cargar el catálogo')
    } finally {
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

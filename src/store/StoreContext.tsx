import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useCatalogo } from '@/hooks/useCatalogo'
import type { CartEntry, CartLine, Product } from '@/types'

const CART_KEY = 'gg.cart.v1'
const FAV_KEY = 'gg.fav.v1'

// ── Persistencia segura (Safari en modo privado puede lanzar) ────────────────
function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* almacenamiento no disponible: la sesión sigue funcionando en memoria */
  }
}

// ── Carrito ─────────────────────────────────────────────────────────────────
type CartAction =
  | { type: 'add'; slug: string; qty?: number }
  | { type: 'remove'; slug: string }
  | { type: 'setQty'; slug: string; qty: number }
  | { type: 'clear' }
  | { type: 'podar'; existentes: Set<string> }

function cartReducer(state: CartLine[], action: CartAction): CartLine[] {
  switch (action.type) {
    case 'add': {
      const qty = action.qty ?? 1
      const existing = state.find((l) => l.slug === action.slug)
      if (existing) {
        return state.map((l) =>
          l.slug === action.slug ? { ...l, qty: Math.min(l.qty + qty, 99) } : l
        )
      }
      return [...state, { slug: action.slug, qty }]
    }
    case 'remove':
      return state.filter((l) => l.slug !== action.slug)
    case 'setQty':
      if (action.qty <= 0) return state.filter((l) => l.slug !== action.slug)
      return state.map((l) =>
        l.slug === action.slug ? { ...l, qty: Math.min(action.qty, 99) } : l
      )
    case 'clear':
      return []
    case 'podar': {
      // Retira productos que ya no existen en el catálogo. Solo se ejecuta
      // cuando el catálogo YA está cargado: hacerlo antes vaciaría el carrito
      // de todo el mundo en cada recarga.
      const limpio = state.filter((l) => action.existentes.has(l.slug))
      return limpio.length === state.length ? state : limpio
    }
  }
}

// ── Toasts ──────────────────────────────────────────────────────────────────
export interface Toast {
  id: number
  message: string
  tone: 'success' | 'info' | 'error'
  image?: string
}

interface StoreValue {
  // carrito
  cart: CartEntry[]
  cartCount: number
  cartTotal: number
  cartHasPending: boolean
  addToCart: (p: Product, qty?: number) => void
  removeFromCart: (slug: string) => void
  setQty: (slug: string, qty: number) => void
  clearCart: () => void
  cartOpen: boolean
  setCartOpen: (v: boolean) => void
  bump: number
  // favoritos
  favorites: string[]
  isFavorite: (slug: string) => boolean
  toggleFavorite: (p: Product) => void
  // toasts
  toasts: Toast[]
  notify: (message: string, tone?: Toast['tone'], image?: string) => void
  dismissToast: (id: number) => void
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const { productos, cargando } = useCatalogo()

  const bySlug = useMemo(() => new Map(productos.map((p) => [p.slug, p])), [productos])

  // Se leen tal cual: mientras no haya catálogo no se puede saber qué es válido.
  const [lines, dispatch] = useReducer(cartReducer, [], () =>
    read<CartLine[]>(CART_KEY, [])
  )
  const [favorites, setFavorites] = useState<string[]>(() => read<string[]>(FAV_KEY, []))
  const [hidratado, setHidratado] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [bump, setBump] = useState(0)
  const toastId = useRef(0)

  // Poda una sola vez, cuando el catálogo ya se conoce.
  useEffect(() => {
    if (cargando || hidratado) return
    if (productos.length > 0) {
      const existentes = new Set(bySlug.keys())
      dispatch({ type: 'podar', existentes })
      setFavorites((f) => {
        const limpio = f.filter((s) => existentes.has(s))
        return limpio.length === f.length ? f : limpio
      })
    }
    setHidratado(true)
  }, [cargando, hidratado, productos.length, bySlug])

  // Nada se guarda antes de la poda: si el catálogo tardara o fallara, el
  // carrito guardado queda intacto en vez de sobrescribirse con uno vacío.
  useEffect(() => {
    if (hidratado) write(CART_KEY, lines)
  }, [lines, hidratado])
  useEffect(() => {
    if (hidratado) write(FAV_KEY, favorites)
  }, [favorites, hidratado])

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const notify = useCallback(
    (message: string, tone: Toast['tone'] = 'success', image?: string) => {
      const id = ++toastId.current
      setToasts((t) => [...t.slice(-2), { id, message, tone, image }])
      window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600)
    },
    []
  )

  const cart = useMemo<CartEntry[]>(
    () =>
      lines
        .map((l) => {
          const product = bySlug.get(l.slug)
          return product ? { product, qty: l.qty } : null
        })
        .filter((x): x is CartEntry => x !== null),
    [lines, bySlug]
  )

  const cartCount = useMemo(() => cart.reduce((n, e) => n + e.qty, 0), [cart])
  const cartTotal = useMemo(
    () => cart.reduce((n, e) => n + (e.product.price ?? 0) * e.qty, 0),
    [cart]
  )
  const cartHasPending = useMemo(() => cart.some((e) => e.product.price === null), [cart])

  const addToCart = useCallback(
    (p: Product, qty = 1) => {
      dispatch({ type: 'add', slug: p.slug, qty })
      setBump((b) => b + 1)
      notify(`${p.name} se agregó al carrito`, 'success', p.images[0])
    },
    [notify]
  )

  const removeFromCart = useCallback((slug: string) => {
    dispatch({ type: 'remove', slug })
  }, [])

  const setQty = useCallback((slug: string, qty: number) => {
    dispatch({ type: 'setQty', slug, qty })
  }, [])

  const clearCart = useCallback(() => {
    dispatch({ type: 'clear' })
    notify('Vaciaste el carrito', 'info')
  }, [notify])

  const isFavorite = useCallback((slug: string) => favorites.includes(slug), [favorites])

  const toggleFavorite = useCallback(
    (p: Product) => {
      setFavorites((f) => {
        const has = f.includes(p.slug)
        notify(
          has ? `${p.name} salió de favoritos` : `${p.name} está en tus favoritos`,
          'info',
          p.images[0]
        )
        return has ? f.filter((s) => s !== p.slug) : [...f, p.slug]
      })
    },
    [notify]
  )

  const value = useMemo<StoreValue>(
    () => ({
      cart,
      cartCount,
      cartTotal,
      cartHasPending,
      addToCart,
      removeFromCart,
      setQty,
      clearCart,
      cartOpen,
      setCartOpen,
      bump,
      favorites,
      isFavorite,
      toggleFavorite,
      toasts,
      notify,
      dismissToast,
    }),
    [
      cart,
      cartCount,
      cartTotal,
      cartHasPending,
      addToCart,
      removeFromCart,
      setQty,
      clearCart,
      cartOpen,
      bump,
      favorites,
      isFavorite,
      toggleFavorite,
      toasts,
      notify,
      dismissToast,
    ]
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore debe usarse dentro de <StoreProvider>')
  return ctx
}

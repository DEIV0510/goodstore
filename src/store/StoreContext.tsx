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
import { products } from '@/data/products'
import type { CartEntry, CartLine, Product } from '@/types'

const CART_KEY = 'gg.cart.v1'
const FAV_KEY = 'gg.fav.v1'

const bySlug = new Map(products.map((p) => [p.slug, p]))

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
  const [lines, dispatch] = useReducer(cartReducer, [], () =>
    read<CartLine[]>(CART_KEY, []).filter((l) => bySlug.has(l.slug))
  )
  const [favorites, setFavorites] = useState<string[]>(() =>
    read<string[]>(FAV_KEY, []).filter((s) => bySlug.has(s))
  )
  const [cartOpen, setCartOpen] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [bump, setBump] = useState(0)
  const toastId = useRef(0)

  useEffect(() => write(CART_KEY, lines), [lines])
  useEffect(() => write(FAV_KEY, favorites), [favorites])

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
    [lines]
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

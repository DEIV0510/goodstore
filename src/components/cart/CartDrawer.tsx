import { Minus, Plus, ShoppingCart, Trash2, MessageCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import Drawer from '@/components/ui/Drawer'
import ProductImage from '@/components/ui/ProductImage'
import { PlatformBadge } from '@/components/ui/Badges'
import { cop, pluralize } from '@/lib/format'
import { cartMessage } from '@/lib/whatsapp'
import { useStore } from '@/store/StoreContext'

export default function CartDrawer() {
  const {
    cart,
    cartOpen,
    setCartOpen,
    cartCount,
    cartTotal,
    cartHasPending,
    setQty,
    removeFromCart,
    clearCart,
  } = useStore()

  const close = () => setCartOpen(false)
  const empty = cart.length === 0

  return (
    <Drawer
      open={cartOpen}
      onClose={close}
      title={empty ? 'Tu carrito' : `Tu carrito · ${cartCount}`}
      labelId="cart-title"
      footer={
        empty ? undefined : (
          <div className="space-y-3">
            <dl className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-white/60">
                  Subtotal ({pluralize(cartCount, 'producto', 'productos')})
                </dt>
                <dd className="tabular font-display text-base font-extrabold text-white">
                  {cartTotal > 0 ? cop(cartTotal) : '—'}
                </dd>
              </div>
              <div className="flex items-center justify-between border-t border-white/10 pt-1.5">
                <dt className="font-bold text-white">Total aproximado</dt>
                <dd className="tabular font-display text-xl font-black text-gold-500">
                  {cartTotal > 0 ? cop(cartTotal) : 'A confirmar'}
                </dd>
              </div>
            </dl>

            {cartHasPending && (
              <p className="rounded-lg border border-gold-500/25 bg-gold-500/[.07] px-3 py-2 text-2xs leading-relaxed text-gold-300">
                Hay productos sin precio publicado. Te confirmamos el valor exacto por
                WhatsApp antes de cerrar el pedido.
              </p>
            )}

            <a
              href={cartMessage(cart)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={close}
              className="btn-primary w-full"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              Finalizar compra
            </a>

            <button
              type="button"
              onClick={clearCart}
              className="btn-ghost w-full text-xs text-white/50"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Vaciar carrito
            </button>
          </div>
        )
      }
    >
      {empty ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-6 py-16 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-white/[.04]">
            <ShoppingCart className="h-7 w-7 text-white/35" aria-hidden="true" />
          </span>
          <div>
            <p className="font-display text-lg font-extrabold text-white">
              Tu carrito está vacío
            </p>
            <p className="mt-1.5 text-sm text-white/55">
              Encuentra tu próximo juego y agrégalo desde el catálogo.
            </p>
          </div>
          <Link to="/catalogo" onClick={close} className="btn-primary">
            Ver catálogo
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-white/[.07]">
          {cart.map(({ product, qty }) => (
            <li key={product.slug} className="flex gap-3 p-3.5">
              <Link
                to={`/producto/${product.slug}`}
                onClick={close}
                className="block h-24 w-[68px] shrink-0 overflow-hidden rounded-lg bg-ink-700"
              >
                <ProductImage
                  src={product.images[0]}
                  alt={`Portada de ${product.name}`}
                  className="h-full w-full"
                />
              </Link>

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start gap-2">
                  <Link
                    to={`/producto/${product.slug}`}
                    onClick={close}
                    className="line-clamp-2 flex-1 text-[13px] font-bold leading-snug text-white transition-colors hover:text-gold-500"
                  >
                    {product.name}
                  </Link>
                  <button
                    type="button"
                    onClick={() => removeFromCart(product.slug)}
                    className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white/40 transition-colors hover:bg-alert-500/15 hover:text-alert-400"
                    aria-label={`Eliminar ${product.name} del carrito`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                <div className="mt-1.5">
                  <PlatformBadge platform={product.platform} />
                </div>

                <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                  <div className="flex items-center rounded-lg border border-white/12 bg-white/[.04]">
                    <button
                      type="button"
                      onClick={() => setQty(product.slug, qty - 1)}
                      className="grid h-9 w-9 place-items-center rounded-l-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                      aria-label={`Quitar una unidad de ${product.name}`}
                    >
                      <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <span
                      className="tabular w-8 text-center text-sm font-bold text-white"
                      aria-live="polite"
                      aria-label={`Cantidad: ${qty}`}
                    >
                      {qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQty(product.slug, qty + 1)}
                      className="grid h-9 w-9 place-items-center rounded-r-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                      aria-label={`Agregar una unidad de ${product.name}`}
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>

                  <p className="tabular text-right font-display text-sm font-extrabold text-gold-500">
                    {product.price === null ? 'Consultar' : cop(product.price * qty)}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  )
}

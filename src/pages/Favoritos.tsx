import { Heart } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import ProductCard from '@/components/catalog/ProductCard'
import { products } from '@/data/products'
import { pluralize } from '@/lib/format'
import { useSeo } from '@/lib/seo'
import { useStore } from '@/store/StoreContext'

export default function Favoritos() {
  const { favorites } = useStore()

  useSeo({
    title: 'Mis favoritos | GOOD GAME',
    description: 'Los videojuegos que guardaste en GOOD GAME para comprar más adelante.',
    path: '/favoritos',
  })

  const items = useMemo(
    () => favorites.map((s) => products.find((p) => p.slug === s)).filter(Boolean) as typeof products,
    [favorites]
  )

  return (
    <div className="gg-container py-10 sm:py-14">
      <h1 className="font-display text-3xl font-black tracking-tight sm:text-4xl">
        Mis favoritos
      </h1>
      <p className="mt-2.5 text-sm text-white/60">
        {items.length === 0
          ? 'Aquí aparecerán los juegos que guardes con el corazón.'
          : `Tienes ${pluralize(items.length, 'juego guardado', 'juegos guardados')}.`}
      </p>

      {items.length === 0 ? (
        <div className="surface mt-8 flex flex-col items-center px-6 py-16 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-white/[.04]">
            <Heart className="h-7 w-7 text-white/35" aria-hidden="true" />
          </span>
          <h2 className="mt-5 font-display text-xl font-black text-white">
            Todavía no guardaste nada
          </h2>
          <p className="mt-2.5 max-w-md text-pretty text-sm text-white/60">
            Explora el catálogo y toca el corazón en los juegos que te interesen para tenerlos
            a mano.
          </p>
          <Link to="/catalogo" className="btn-primary mt-6">
            Ver catálogo
          </Link>
        </div>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((p, i) => (
            <li key={p.slug}>
              <ProductCard product={p} priority={i < 5} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

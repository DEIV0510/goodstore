import { useMemo } from 'react'
import Hero from '@/components/home/Hero'
import Benefits from '@/components/home/Benefits'
import Categories from '@/components/home/Categories'
import ProductCard from '@/components/catalog/ProductCard'
import ProductRow from '@/components/home/ProductRow'
import SectionHeading from '@/components/home/SectionHeading'
import UsedBanner from '@/components/home/UsedBanner'
import ConsolesAccessories from '@/components/home/ConsolesAccessories'
import Trust from '@/components/home/Trust'
import WhatsAppCta from '@/components/home/WhatsAppCta'
import Faq from '@/components/home/Faq'
import { products } from '@/data/products'
import { useSeo } from '@/lib/seo'

export default function Home() {
  useSeo({
    title: 'GOOD GAME | Videojuegos, Consolas y Accesorios',
    description:
      'Compra videojuegos, consolas y accesorios en GOOD GAME. Encuentra títulos para PlayStation y Nintendo Switch, juegos usados y más. Envíos a Medellín y toda Colombia.',
    path: '/',
  })

  const featured = useMemo(() => products.filter((p) => p.featured).slice(0, 12), [])
  const ps = useMemo(
    () => products.filter((p) => p.platform === 'ps5' || p.platform === 'ps4').slice(0, 14),
    []
  )
  const switchGames = useMemo(
    () => products.filter((p) => p.platform === 'switch').slice(0, 14),
    []
  )

  return (
    <>
      <Hero />
      <Benefits />
      <Categories />

      {/* Destacados en rejilla: el bloque de producto más visible del home */}
      <section className="gg-container py-10 sm:py-12" aria-labelledby="destacados-title">
        <SectionHeading
          id="destacados-title"
          eyebrow="Lo más buscado"
          title="Videojuegos destacados"
          linkTo="/catalogo"
          linkLabel={`Ver los ${products.length} juegos`}
        />
        <ul className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {featured.map((p, i) => (
            <li key={p.slug}>
              <ProductCard product={p} priority={i < 6} showFeaturedBadge={false} />
            </li>
          ))}
        </ul>
      </section>

      <UsedBanner />

      <section className="gg-container py-10 sm:py-12" aria-labelledby="playstation-title">
        <SectionHeading
          id="playstation-title"
          eyebrow="PlayStation"
          title="Juegos para PS5 y PS4"
          linkTo="/catalogo?plataforma=ps5,ps4"
          linkLabel="Ver PlayStation"
        />
        <ProductRow items={ps} />
      </section>

      <section className="gg-container py-10 sm:py-12" aria-labelledby="switch-title">
        <SectionHeading
          id="switch-title"
          eyebrow="Nintendo Switch"
          title="Juegos para Nintendo Switch"
          linkTo="/catalogo?plataforma=switch"
          linkLabel="Ver Nintendo Switch"
        />
        <ProductRow items={switchGames} />
      </section>

      <ConsolesAccessories />
      <Trust />
      <WhatsAppCta />
      <Faq />
    </>
  )
}

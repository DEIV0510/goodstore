import { useMemo } from 'react'
import Hero from '@/components/home/Hero'
import Benefits from '@/components/home/Benefits'
import BannerPromo from '@/components/home/BannerPromo'
import Categories from '@/components/home/Categories'
import ProductCard from '@/components/catalog/ProductCard'
import ProductRow from '@/components/home/ProductRow'
import SectionHeading from '@/components/home/SectionHeading'
import UsedBanner from '@/components/home/UsedBanner'
import ConsolesAccessories from '@/components/home/ConsolesAccessories'
import Trust from '@/components/home/Trust'
import WhatsAppCta from '@/components/home/WhatsAppCta'
import Faq from '@/components/home/Faq'
import { useCatalogo } from '@/hooks/useCatalogo'
import { useSeo } from '@/lib/seo'

// ─────────────────────────────────────────────────────────────────────────────
// Portada.
//
// Qué bloques se muestran lo decide el administrador en /admin/contenido. Un
// bloque apagado no se pinta; uno encendido que se quedaría vacío (por ejemplo
// destacados sin ningún producto marcado) tampoco, para no dejar huecos.
// ─────────────────────────────────────────────────────────────────────────────

export default function Home() {
  const { productos, contenido, ajustes } = useCatalogo()
  const secciones = contenido.sections

  useSeo({
    title: ajustes.seo.title,
    description: ajustes.seo.description,
    path: '/',
  })

  const featured = useMemo(
    () => productos.filter((p) => p.featured).slice(0, 12),
    [productos]
  )
  const ps = useMemo(
    () =>
      productos.filter((p) => p.platform === 'ps5' || p.platform === 'ps4').slice(0, 14),
    [productos]
  )
  const switchGames = useMemo(
    () => productos.filter((p) => p.platform === 'switch').slice(0, 14),
    [productos]
  )

  return (
    <>
      <Hero />
      <Benefits />
      {secciones.banner && <BannerPromo />}

      {/* Productos primero: es el bloque más visible del home, antes que nada más */}
      {secciones.destacados && featured.length > 0 && (
        <section className="gg-container py-10 sm:py-12" aria-labelledby="destacados-title">
          <SectionHeading
            id="destacados-title"
            eyebrow="Lo más buscado"
            title="Videojuegos destacados"
            linkTo="/catalogo"
            linkLabel={`Ver los ${productos.length} juegos`}
          />
          <ul className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {featured.map((p, i) => (
              <li key={p.slug}>
                <ProductCard product={p} priority={i < 6} showFeaturedBadge={false} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {secciones.categorias && <Categories />}
      {secciones.usados && <UsedBanner />}

      {secciones.playstation && ps.length > 0 && (
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
      )}

      {secciones.nintendo && switchGames.length > 0 && (
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
      )}

      {secciones.consolas && <ConsolesAccessories />}
      {secciones.confianza && <Trust />}
      {secciones.whatsapp && <WhatsAppCta />}
      {secciones.faq && <Faq />}
    </>
  )
}

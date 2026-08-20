import { Home, MessageCircle, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { LogoMark } from '@/components/brand/Logo'
import { MESSAGES, waLink } from '@/data/site'
import { useSeo } from '@/lib/seo'

export default function NotFound() {
  useSeo({
    title: 'Game Over — página no encontrada | GOOD GAME',
    description: 'La página que buscas no existe. Vuelve a la tienda de GOOD GAME.',
    path: '/404',
  })

  return (
    <section className="relative flex min-h-[74vh] items-center overflow-hidden">
      <div className="absolute inset-0 z-0" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(105%_75%_at_50%_10%,#141BA4_0%,#070A78_35%,#070C42_68%,#070C42_100%)]" />
        <div className="absolute inset-0 bg-tech opacity-45 [mask-image:radial-gradient(70%_60%_at_50%_40%,#000_10%,transparent_82%)]" />
      </div>

      <div className="gg-container relative z-10 py-16 text-center">
        <LogoMark className="mx-auto h-16 w-16 opacity-90" />

        <p className="eyebrow mt-8 justify-center">Error 404</p>

        <h1
          className="mt-4 font-display text-[3.2rem] font-black leading-none tracking-tight text-gold-500 sm:text-[5.5rem]"
          style={{ fontStretch: '118%' }}
        >
          GAME OVER
        </h1>

        <p className="mx-auto mt-5 max-w-md text-pretty text-base text-white/70">
          Esta página no existe. Puede que el enlace esté roto o que el producto ya no esté
          publicado.
        </p>

        <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row">
          <Link to="/" className="btn-primary h-13 px-7 text-sm">
            <Home className="h-4 w-4" aria-hidden="true" />
            Volver a la tienda
          </Link>
          <Link to="/catalogo" className="btn-secondary h-13 px-7 text-sm">
            <Search className="h-4 w-4" aria-hidden="true" />
            Ver catálogo
          </Link>
          <a
            href={waLink(MESSAGES.general)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-wa h-13 px-7 text-sm"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            WhatsApp
          </a>
        </div>
      </div>
    </section>
  )
}

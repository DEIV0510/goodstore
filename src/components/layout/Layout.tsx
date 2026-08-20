import type { ReactNode } from 'react'
import CartDrawer from '@/components/cart/CartDrawer'
import Toasts from '@/components/ui/Toasts'
import FloatingActions from './FloatingActions'
import Footer from './Footer'
import Header from './Header'

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main
        id="contenido"
        tabIndex={-1}
        className="flex-1 pt-[var(--gg-header)] focus:outline-none"
      >
        {children}
      </main>
      <Footer />
      <FloatingActions />
      <CartDrawer />
      <Toasts />
    </div>
  )
}

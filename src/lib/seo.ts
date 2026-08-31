import { useEffect } from 'react'
import { site } from '@/data/site'

interface Seo {
  title: string
  description: string
  path: string
  image?: string
  /** Datos estructurados schema.org para páginas de producto. */
  jsonLd?: Record<string, unknown>
  /** Para páginas que no deben salir en Google: el resultado de un pago, etc. */
  noindex?: boolean
}

const setMeta = (selector: string, attr: string, value: string) => {
  let el = document.head.querySelector<HTMLMetaElement | HTMLLinkElement>(selector)
  if (!el) {
    if (selector.startsWith('link')) {
      el = document.createElement('link')
      el.setAttribute('rel', 'canonical')
    } else {
      el = document.createElement('meta')
      const m = selector.match(/\[(name|property)="([^"]+)"\]/)
      if (m) el.setAttribute(m[1], m[2])
    }
    document.head.appendChild(el)
  }
  el.setAttribute(attr, value)
}

/** Actualiza title, description, canonical, Open Graph y JSON-LD por ruta. */
export function useSeo({ title, description, path, image, jsonLd, noindex }: Seo) {
  useEffect(() => {
    document.title = title
    const url = `${site.url}${path}`
    const img = `${site.url}${image ?? '/og-image.png'}`

    setMeta('meta[name="description"]', 'content', description)
    setMeta('link[rel="canonical"]', 'href', url)
    setMeta('meta[property="og:title"]', 'content', title)
    setMeta('meta[property="og:description"]', 'content', description)
    setMeta('meta[property="og:url"]', 'content', url)
    setMeta('meta[property="og:image"]', 'content', img)
    setMeta('meta[property="og:type"]', 'content', path.startsWith('/producto/') ? 'product' : 'website')

    // La etiqueta se quita al salir, no solo se cambia: dejarla puesta
    // desindexaría la siguiente página que visite el usuario.
    const robots = document.head.querySelector('meta[name="robots"]')
    if (noindex) {
      setMeta('meta[name="robots"]', 'content', 'noindex, nofollow')
    } else if (robots) {
      robots.remove()
    }

    const prev = document.getElementById('gg-jsonld-page')
    prev?.remove()
    if (jsonLd) {
      const script = document.createElement('script')
      script.type = 'application/ld+json'
      script.id = 'gg-jsonld-page'
      script.textContent = JSON.stringify(jsonLd)
      document.head.appendChild(script)
    }

    return () => {
      document.getElementById('gg-jsonld-page')?.remove()
      // Se quita al salir, no basta con cambiarla: dejarla puesta
      // desindexaría la siguiente página que visite el cliente.
      if (noindex) document.head.querySelector('meta[name="robots"]')?.remove()
    }
  }, [title, description, path, image, jsonLd, noindex])
}

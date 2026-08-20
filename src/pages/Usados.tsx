import { ChevronRight, Home, MessageCircle, RefreshCw, Send } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import ProductImage from '@/components/ui/ProductImage'
import { PLATFORMS } from '@/data/taxonomy'
import { MESSAGES, site, waLink } from '@/data/site'
import { usedGameMessage } from '@/lib/whatsapp'
import { useSeo } from '@/lib/seo'
import { useStore } from '@/store/StoreContext'

const ESTADOS = [
  'Como nuevo (caja y disco/cartucho en buen estado)',
  'Buen estado (uso normal)',
  'Estado regular (marcas visibles)',
  'Sin caja / solo disco o cartucho',
]

const COVERS = [
  '/games/the-last-of-us-remastered-ps4.webp',
  '/games/rayman-legends-ps4.webp',
  '/games/god-of-war-iii-remastered-ps4.webp',
]

const PASOS = [
  {
    n: '01',
    title: 'Cuéntanos qué tienes',
    text: 'Llena el formulario con la plataforma, el título y el estado del juego.',
  },
  {
    n: '02',
    title: 'Envíanos fotos',
    text: 'Al abrir WhatsApp puedes adjuntar las fotos de la caja y del disco o cartucho.',
  },
  {
    n: '03',
    title: 'Lo revisamos contigo',
    text: 'Te decimos si nos interesa y bajo qué condiciones: compra, venta o parte de pago.',
  },
]

const empty = {
  nombre: '',
  whatsapp: '',
  plataforma: '',
  juego: '',
  estado: '',
  fotos: '',
  comentario: '',
}

export default function Usados() {
  const [form, setForm] = useState(empty)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { notify } = useStore()

  useSeo({
    title: 'Vende o entrega tus videojuegos usados | GOOD GAME',
    description:
      'GOOD GAME contempla la compra, venta o recibimiento de videojuegos usados como parte de pago. Cuéntanos qué tienes y lo revisamos contigo por WhatsApp.',
    path: '/usados',
  })

  const set = (k: keyof typeof empty, v: string) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => {
      if (!e[k]) return e
      const next = { ...e }
      delete next[k]
      return next
    })
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (form.nombre.trim().length < 2) e.nombre = 'Escribe tu nombre.'
    const phone = form.whatsapp.replace(/\D/g, '')
    if (phone.length < 10) e.whatsapp = 'Escribe un número de WhatsApp válido (10 dígitos).'
    if (!form.plataforma) e.plataforma = 'Selecciona la plataforma.'
    if (form.juego.trim().length < 2) e.juego = 'Dinos qué juego es.'
    if (!form.estado) e.estado = 'Selecciona el estado del juego.'
    return e
  }

  const onSubmit = (ev: React.FormEvent) => {
    ev.preventDefault()
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length > 0) {
      const first = document.getElementById(`campo-${Object.keys(e)[0]}`)
      first?.focus()
      notify('Revisa los campos marcados', 'error')
      return
    }
    window.open(usedGameMessage(form), '_blank', 'noopener,noreferrer')
    notify('Abrimos WhatsApp con tu información', 'success')
  }

  const field =
    'h-12 w-full rounded-xl border bg-ink-900/40 px-3.5 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-gold-500/60'
  const labelCls = 'mb-1.5 block text-xs font-bold text-white/75'
  const errCls = 'mt-1.5 flex items-center gap-1 text-2xs font-semibold text-alert-400'

  return (
    <div className="pb-8">
      <div className="relative overflow-hidden border-b border-white/10 bg-[linear-gradient(160deg,#0C1287_0%,#070A78_42%,#070C42_100%)]">
        <div className="pointer-events-none absolute inset-0 bg-tech opacity-40" aria-hidden="true" />
        <div className="gg-container relative py-9 sm:py-14">
          <nav aria-label="Ruta de navegación">
            <ol className="flex items-center gap-1.5 text-2xs font-semibold text-white/50">
              <li>
                <Link to="/" className="inline-flex items-center gap-1 hover:text-gold-500">
                  <Home className="h-3.5 w-3.5" aria-hidden="true" />
                  Inicio
                </Link>
              </li>
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
              <li aria-current="page" className="text-white/80">
                Videojuegos usados
              </li>
            </ol>
          </nav>

          <div className="mt-4 grid items-center gap-8 lg:grid-cols-[minmax(0,1fr),auto]">
            <div>
              <p className="eyebrow">
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Compra · Venta · Parte de pago
              </p>
              <h1
                className="mt-3 max-w-2xl text-balance font-display text-3xl font-black leading-tight tracking-tight sm:text-[2.75rem]"
                style={{ fontStretch: '110%' }}
              >
                Dale una segunda vida a tus juegos
              </h1>
              <p className="mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-white/70 sm:text-base">
                Compramos, vendemos y recibimos videojuegos usados como parte de pago cuando
                aplique. Cada caso se valora contigo según el título y su estado.
              </p>
            </div>

            <div className="hidden items-end gap-3 lg:flex">
              {COVERS.map((src, i) => (
                <span
                  key={src}
                  className="block w-[110px] overflow-hidden rounded-lg border border-white/12 shadow-[0_18px_34px_-16px_rgba(0,0,0,.95)]"
                  style={{ transform: `translateY(${[16, 0, 10][i]}px) rotate(${[-6, 0, 6][i]}deg)` }}
                >
                  <ProductImage src={src} alt="" className="aspect-[3/4] w-full" />
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="gg-container py-12">
        <ol className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-2.5 rounded-card border border-white/10 bg-ink-700/35 px-4 py-3.5">
          {PASOS.map((p) => (
            <li key={p.n} className="flex items-center gap-2 text-xs font-semibold text-white/65">
              <span className="font-display text-sm font-black text-gold-500">{p.n}</span>
              {p.title}
            </li>
          ))}
        </ol>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr),minmax(0,.85fr)]">
          {/* Formulario */}
          <section aria-labelledby="form-title" className="surface p-5 sm:p-7">
            <h2 id="form-title" className="font-display text-xl font-black tracking-tight">
              Quiero vender / entregar mi juego
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-white/55">
              Completa los datos y te abrimos WhatsApp con toda la información lista. Los
              campos marcados con <span className="text-alert-400">*</span> son obligatorios.
            </p>

            <form onSubmit={onSubmit} noValidate className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="campo-nombre" className={labelCls}>
                  Nombre <span className="text-alert-400">*</span>
                </label>
                <input
                  id="campo-nombre"
                  value={form.nombre}
                  onChange={(e) => set('nombre', e.target.value)}
                  autoComplete="name"
                  placeholder="Tu nombre"
                  aria-invalid={Boolean(errors.nombre)}
                  aria-describedby={errors.nombre ? 'err-nombre' : undefined}
                  className={`${field} ${errors.nombre ? 'border-alert-500' : 'border-white/12'}`}
                />
                {errors.nombre && (
                  <p id="err-nombre" role="alert" className={errCls}>
                    {errors.nombre}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="campo-whatsapp" className={labelCls}>
                  WhatsApp <span className="text-alert-400">*</span>
                </label>
                <input
                  id="campo-whatsapp"
                  value={form.whatsapp}
                  onChange={(e) => set('whatsapp', e.target.value)}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="300 000 0000"
                  aria-invalid={Boolean(errors.whatsapp)}
                  aria-describedby={errors.whatsapp ? 'err-whatsapp' : undefined}
                  className={`${field} ${errors.whatsapp ? 'border-alert-500' : 'border-white/12'}`}
                />
                {errors.whatsapp && (
                  <p id="err-whatsapp" role="alert" className={errCls}>
                    {errors.whatsapp}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="campo-plataforma" className={labelCls}>
                  Plataforma <span className="text-alert-400">*</span>
                </label>
                <select
                  id="campo-plataforma"
                  value={form.plataforma}
                  onChange={(e) => set('plataforma', e.target.value)}
                  aria-invalid={Boolean(errors.plataforma)}
                  aria-describedby={errors.plataforma ? 'err-plataforma' : undefined}
                  className={`${field} ${errors.plataforma ? 'border-alert-500' : 'border-white/12'}`}
                >
                  <option value="">Selecciona…</option>
                  {PLATFORMS.map((p) => (
                    <option key={p.id} value={p.label}>
                      {p.label}
                    </option>
                  ))}
                  <option value="Otra">Otra</option>
                </select>
                {errors.plataforma && (
                  <p id="err-plataforma" role="alert" className={errCls}>
                    {errors.plataforma}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="campo-juego" className={labelCls}>
                  Juego <span className="text-alert-400">*</span>
                </label>
                <input
                  id="campo-juego"
                  value={form.juego}
                  onChange={(e) => set('juego', e.target.value)}
                  placeholder="Ej: God of War Ragnarök"
                  aria-invalid={Boolean(errors.juego)}
                  aria-describedby={errors.juego ? 'err-juego' : undefined}
                  className={`${field} ${errors.juego ? 'border-alert-500' : 'border-white/12'}`}
                />
                {errors.juego && (
                  <p id="err-juego" role="alert" className={errCls}>
                    {errors.juego}
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="campo-estado" className={labelCls}>
                  Estado <span className="text-alert-400">*</span>
                </label>
                <select
                  id="campo-estado"
                  value={form.estado}
                  onChange={(e) => set('estado', e.target.value)}
                  aria-invalid={Boolean(errors.estado)}
                  aria-describedby={errors.estado ? 'err-estado' : undefined}
                  className={`${field} ${errors.estado ? 'border-alert-500' : 'border-white/12'}`}
                >
                  <option value="">Selecciona…</option>
                  {ESTADOS.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
                {errors.estado && (
                  <p id="err-estado" role="alert" className={errCls}>
                    {errors.estado}
                  </p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="campo-fotos" className={labelCls}>
                  Fotografías
                </label>
                <input
                  id="campo-fotos"
                  value={form.fotos}
                  onChange={(e) => set('fotos', e.target.value)}
                  placeholder="Enlace a las fotos (opcional)"
                  className={`${field} border-white/12`}
                />
                <p className="mt-1.5 text-2xs leading-relaxed text-white/40">
                  Si no tienes un enlace, no te preocupes: puedes adjuntar las fotos
                  directamente en el chat de WhatsApp que se abrirá.
                </p>
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="campo-comentario" className={labelCls}>
                  Comentario
                </label>
                <textarea
                  id="campo-comentario"
                  value={form.comentario}
                  onChange={(e) => set('comentario', e.target.value)}
                  rows={3}
                  placeholder="¿Buscas venderlo o cambiarlo por otro título?"
                  className="w-full rounded-xl border border-white/12 bg-ink-900/40 p-3.5 text-sm text-white outline-none transition-colors placeholder:text-white/30 focus:border-gold-500/60"
                />
              </div>

              <div className="sm:col-span-2">
                <button type="submit" className="btn-primary h-13 w-full text-sm">
                  <Send className="h-4 w-4" aria-hidden="true" />
                  Enviar por WhatsApp
                </button>
                <p className="mt-3 text-center text-2xs leading-relaxed text-white/40">
                  No guardamos tus datos: el formulario solo arma el mensaje y lo abre en tu
                  WhatsApp para que lo envíes tú.
                </p>
              </div>
            </form>
          </section>

          {/* Nota lateral */}
          <aside className="space-y-4">
            <div className="surface p-5 sm:p-6">
              <h2 className="font-display text-base font-extrabold text-white">
                ¿Cómo se valora un juego?
              </h2>
              <p className="mt-2.5 text-[13px] leading-relaxed text-white/60">
                Depende del título, la plataforma, la demanda del momento y el estado de la
                caja y del disco o cartucho. Por eso no publicamos una tabla fija: la
                valoración se confirma contigo en la conversación.
              </p>
            </div>

            <div className="surface p-5 sm:p-6">
              <h2 className="font-display text-base font-extrabold text-white">
                ¿Prefieres escribir directo?
              </h2>
              <p className="mt-2.5 text-[13px] leading-relaxed text-white/60">
                También puedes escribirnos sin llenar el formulario y contarnos qué tienes.
              </p>
              <a
                href={waLink(MESSAGES.general)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-wa mt-4 w-full text-xs"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Escribir a {site.whatsappDisplay}
              </a>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

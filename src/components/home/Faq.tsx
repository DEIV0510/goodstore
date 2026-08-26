import { ChevronDown, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { useCatalogo } from '@/hooks/useCatalogo'
import { MESSAGES, waLink } from '@/data/site'
import SectionHeading from './SectionHeading'

export default function Faq() {
  const { faq } = useCatalogo()
  const [open, setOpen] = useState<number | null>(0)

  // Si desde el panel se ocultan todas las preguntas, la sección desaparece en
  // vez de dejar un acordeón vacío en mitad de la portada.
  if (faq.length === 0) return null

  return (
    <section id="preguntas" className="gg-container py-10 sm:py-12" aria-labelledby="faq-title">
      <SectionHeading
        id="faq-title"
        eyebrow="Preguntas frecuentes"
        title="Resolvemos tus dudas"
        align="center"
      />

      <div className="mx-auto max-w-3xl space-y-2.5">
        {faq.map((item, i) => {
          const isOpen = open === i
          return (
            <div
              key={item.id}
              className={`overflow-hidden rounded-card border transition-colors duration-300 ${
                isOpen ? 'border-gold-500/30 bg-ink-700/70' : 'border-white/10 bg-ink-700/40'
              }`}
            >
              <h3>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${i}`}
                  id={`faq-button-${i}`}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[.03]"
                >
                  <span
                    className={`flex-1 font-display text-[15px] font-bold leading-snug transition-colors sm:text-base ${
                      isOpen ? 'text-gold-500' : 'text-white'
                    }`}
                  >
                    {item.question}
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-white/50 transition-transform duration-300 ${
                      isOpen ? 'rotate-180 text-gold-500' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>
              </h3>
              <div
                id={`faq-panel-${i}`}
                role="region"
                aria-labelledby={`faq-button-${i}`}
                hidden={!isOpen}
                className="px-5 pb-5"
              >
                <p className="text-pretty text-sm leading-relaxed text-white/65">{item.answer}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mx-auto mt-8 max-w-3xl text-center">
        <a
          href={waLink(MESSAGES.general)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary"
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          Tengo otra pregunta
        </a>
      </div>
    </section>
  )
}

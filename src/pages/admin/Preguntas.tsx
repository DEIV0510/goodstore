import { ChevronDown, ChevronUp, HelpCircle, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAvisos } from '@/components/admin/Avisos'
import { Modal, useConfirmar } from '@/components/admin/Modal'
import {
  AreaTexto,
  BotonGuardar,
  Cargando,
  Encabezado,
  Entrada,
  ErrorEstado,
  EstadoVacio,
  Etiqueta,
  Interruptor,
} from '@/components/admin/UI'
import {
  actualizarFaq,
  crearFaq,
  eliminarFaq,
  listarFaq,
  reordenarFaq,
  type FaqInput,
} from '@/services/contenido'
import type { FaqItem } from '@/types'

// ─────────────────────────────────────────────────────────────────────────────
// Preguntas frecuentes de la portada.
//
// El orden importa tanto como el texto: la primera pregunta es la que más se
// lee. Por eso se administra como una lista ordenable y no como una tabla.
//
// Sin base de datos conectada la lectura devuelve las preguntas que hoy están
// publicadas en la tienda; cualquier cambio lanzará un error explicando que
// falta el backend, y eso es lo correcto.
// ─────────────────────────────────────────────────────────────────────────────

interface Borrador {
  question: string
  answer: string
  active: boolean
}

const BORRADOR_VACIO: Borrador = { question: '', answer: '', active: true }

export default function Preguntas() {
  const avisos = useAvisos()
  const confirmar = useConfirmar()

  const [preguntas, setPreguntas] = useState<FaqItem[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [abierto, setAbierto] = useState(false)
  const [editando, setEditando] = useState<FaqItem | null>(null)
  const [borrador, setBorrador] = useState<Borrador>(BORRADOR_VACIO)
  const [errores, setErrores] = useState<{ question?: string; answer?: string }>({})
  const [guardando, setGuardando] = useState(false)
  const [reordenando, setReordenando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      // `todas: true` incluye las ocultas: aquí se administran, en la tienda no.
      setPreguntas(await listarFaq({ todas: true }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las preguntas')
    } finally {
      setCargando(false)
    }
  }, [])
  useEffect(() => {
    void cargar()
  }, [cargar])

  /**
   * Máximo + 1, no `preguntas.length`: si antes se borró alguna, los sortOrder
   * quedan con huecos (0, 1, 3) y la longitud repetiría un número ya usado, lo
   * que deja dos preguntas empatadas y en orden impredecible en la portada.
   */
  const siguienteOrden = () =>
    preguntas.reduce((mayor, f) => Math.max(mayor, f.sortOrder), -1) + 1

  function abrirNueva() {
    setEditando(null)
    setBorrador(BORRADOR_VACIO)
    setErrores({})
    setAbierto(true)
  }

  function abrirEdicion(f: FaqItem) {
    setEditando(f)
    setBorrador({ question: f.question, answer: f.answer, active: f.active })
    setErrores({})
    setAbierto(true)
  }

  /**
   * Tiene que ser estable entre renders. `Modal` rearma su efecto de foco cada
   * vez que cambia `onCerrar`; con una función nueva en cada render el efecto
   * se reiniciaba en cada tecla y el foco saltaba fuera del campo que se estaba
   * escribiendo.
   */
  const cerrar = useCallback(() => {
    if (guardando) return
    setAbierto(false)
  }, [guardando])

  const cambiar = (parcial: Partial<Borrador>) =>
    setBorrador((b) => ({ ...b, ...parcial }))

  async function guardar(e: FormEvent) {
    e.preventDefault()

    const problemas: { question?: string; answer?: string } = {}
    if (!borrador.question.trim()) problemas.question = 'Escribe la pregunta.'
    if (!borrador.answer.trim()) problemas.answer = 'Escribe la respuesta.'

    setErrores(problemas)
    if (Object.keys(problemas).length > 0) return

    const entrada: FaqInput = {
      question: borrador.question.trim(),
      answer: borrador.answer.trim(),
      active: borrador.active,
      // Las nuevas van al final; editar no debe cambiar el orden establecido.
      sortOrder: editando ? editando.sortOrder : siguienteOrden(),
    }

    setGuardando(true)
    try {
      if (editando) {
        const actualizada = await actualizarFaq(editando.id, entrada)
        setPreguntas((lista) =>
          lista.map((f) => (f.id === actualizada.id ? actualizada : f))
        )
        avisos.exito('Pregunta actualizada.')
      } else {
        const creada = await crearFaq(entrada)
        setPreguntas((lista) => [...lista, creada])
        avisos.exito('Pregunta agregada.')
      }
      setAbierto(false)
    } catch (err) {
      avisos.error(err)
    } finally {
      setGuardando(false)
    }
  }

  /**
   * `reordenarFaq` no devuelve la lista nueva, así que el orden se recalcula
   * aquí y se pinta antes de que responda el servidor. Si el guardado falla se
   * restaura el orden anterior: nunca queda una lista en pantalla que no sea
   * la que está guardada.
   */
  async function mover(indice: number, delta: number) {
    const destino = indice + delta
    if (destino < 0 || destino >= preguntas.length) return

    const previas = preguntas
    const copia = [...preguntas]
    const [sacada] = copia.splice(indice, 1)
    copia.splice(destino, 0, sacada)
    const ordenadas = copia.map((f, i) => ({ ...f, sortOrder: i }))

    setPreguntas(ordenadas)
    setReordenando(true)
    try {
      await reordenarFaq(ordenadas.map((f) => f.id))
    } catch (err) {
      setPreguntas(previas)
      avisos.error(err)
    } finally {
      setReordenando(false)
    }
  }

  async function borrar(f: FaqItem) {
    const seguro = await confirmar({
      titulo: 'Eliminar pregunta',
      mensaje: `Se eliminará «${f.question}» de la portada. Esta acción no se puede deshacer.`,
      confirmar: 'Eliminar pregunta',
      peligroso: true,
    })
    if (!seguro) return

    try {
      await eliminarFaq(f.id)
      setPreguntas((lista) => lista.filter((x) => x.id !== f.id))
      avisos.exito('Pregunta eliminada.')
    } catch (err) {
      avisos.error(err)
    }
  }

  if (cargando) return <Cargando texto="Cargando preguntas…" />
  if (error) return <ErrorEstado mensaje={error} onReintentar={() => void cargar()} />

  return (
    <>
      <Encabezado
        titulo="Preguntas frecuentes"
        descripcion="Se muestran en la portada, en el orden que definas aquí."
      >
        <button type="button" onClick={abrirNueva} className="adm-btn-primary">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Agregar pregunta
        </button>
      </Encabezado>

      {preguntas.length === 0 ? (
        <div className="adm-card">
          <EstadoVacio
            icono={HelpCircle}
            titulo="Aún no hay preguntas frecuentes"
            descripcion="Agrega las dudas que más te escriben por WhatsApp: envíos, garantía, formas de pago o estado de los juegos usados."
          >
            <button type="button" onClick={abrirNueva} className="adm-btn-primary">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Agregar pregunta
            </button>
          </EstadoVacio>
        </div>
      ) : (
        <ol className="space-y-3">
          {preguntas.map((f, i) => (
            <li key={f.id} className="adm-card-pad">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 gap-3">
                  <span
                    className="adm-num grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-[12.5px] font-bold text-slate-500"
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold leading-snug text-slate-900">
                      {f.question}
                    </p>
                    <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-slate-600">
                      {f.answer}
                    </p>
                    <div className="mt-2">
                      {f.active ? (
                        <Etiqueta tono="verde">Visible</Etiqueta>
                      ) : (
                        <Etiqueta tono="gris">Oculta</Etiqueta>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
                  <button
                    type="button"
                    onClick={() => abrirEdicion(f)}
                    className="adm-btn-suave"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    Editar
                  </button>
                  {/* Botones de solo icono: el aria-label nombra la pregunta
                      para que fuera de contexto siga siendo comprensible, y
                      miden 44 px porque son el objetivo más pequeño de la fila. */}
                  <button
                    type="button"
                    onClick={() => void mover(i, -1)}
                    disabled={i === 0 || reordenando}
                    aria-label={`Subir «${f.question}»`}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-slate-300 bg-white text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-40"
                  >
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void mover(i, 1)}
                    disabled={i === preguntas.length - 1 || reordenando}
                    aria-label={`Bajar «${f.question}»`}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-slate-300 bg-white text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-40"
                  >
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void borrar(f)}
                    className="adm-btn-fantasma text-alert-600 hover:bg-red-50 hover:text-alert-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Eliminar
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <Modal
        abierto={abierto}
        onCerrar={cerrar}
        titulo={editando ? 'Editar pregunta' : 'Agregar pregunta'}
        descripcion="Responde como le hablarías a un cliente por WhatsApp: corto y concreto."
        ancho="md"
        pie={
          <>
            <button
              type="button"
              onClick={cerrar}
              disabled={guardando}
              className="adm-btn-suave"
            >
              Cancelar
            </button>
            {/* El botón está en el pie, fuera del <form>: `form` los reconecta. */}
            <BotonGuardar form="form-pregunta" guardando={guardando}>
              {editando ? 'Guardar cambios' : 'Agregar pregunta'}
            </BotonGuardar>
          </>
        }
      >
        <form id="form-pregunta" onSubmit={guardar} className="space-y-4" noValidate>
          <Entrada
            label="Pregunta"
            requerido
            value={borrador.question}
            onChange={(e) => cambiar({ question: e.target.value })}
            error={errores.question}
            placeholder="¿Hacen envíos a toda Colombia?"
            maxLength={120}
          />

          <AreaTexto
            label="Respuesta"
            requerido
            rows={5}
            value={borrador.answer}
            onChange={(e) => cambiar({ answer: e.target.value })}
            error={errores.answer}
            ayuda="Dos o tres líneas bastan. Si la respuesta depende del caso, invita a escribir por WhatsApp."
            placeholder="Sí, enviamos a todo el país por transportadora."
          />

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
            <Interruptor
              activo={borrador.active}
              onChange={(v) => cambiar({ active: v })}
              label="Visible en la tienda"
              descripcion="Una pregunta oculta se guarda aquí pero no aparece en la portada."
            />
          </div>
        </form>
      </Modal>
    </>
  )
}

<?php
declare(strict_types=1);

/**
 * /api/contenido · /api/banners · /api/preguntas
 *
 * Lo que el negocio escribe y ordena: la portada (cabecera, beneficios y qué
 * secciones se ven), las franjas promocionales y las preguntas frecuentes.
 *
 * Tres recursos en un mismo archivo porque son la misma pantalla del panel
 * vista por tres lados, y comparten las reglas de validación de aquí abajo.
 *
 * Regla de fondo de todo el archivo: NADA de lo que manda el navegador se
 * guarda tal cual. Cada bloque se vuelve a construir campo a campo con los
 * validadores del núcleo. Un objeto arbitrario guardado a ciegas acabaría
 * pintado en la portada de la tienda, que es la página que ve todo el mundo.
 */

/** Segundo segmento: la clave del contenido, el id del registro o «orden». */
$seccion = $ruta[1] ?? '';
$metodo = gg_metodo();
$cuerpo = in_array($metodo, ['POST', 'PATCH', 'PUT'], true) ? gg_cuerpo() : [];

// ─────────────────────────────────────────────────────────────────────────────
// Ayudas de este archivo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bandera de la dirección: ?todos=1, ?todas=1.
 *
 * Escribirla sin valor (?todos) también cuenta como sí: es como se teclea a
 * mano en la barra del navegador y sería raro que ahí no hiciera nada.
 */
function gg_bandera(string $clave): bool
{
    if (!isset($_GET[$clave])) {
        return false;
    }
    if ($_GET[$clave] === '') {
        return true;
    }
    return filter_var($_GET[$clave], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? false;
}

/**
 * ¿Esto llegó como un objeto y no como una lista?
 *
 * La trampa: en JSON `{}` y `[]` son cosas distintas, pero al decodificar los
 * dos acaban siendo un array vacío de PHP. Por eso un array vacío se acepta
 * como objeto: es lo que manda un formulario sin nada marcado, y rechazarlo
 * daría un error incomprensible.
 */
function gg_es_objeto($valor): bool
{
    return is_array($valor) && ($valor === [] || !array_is_list($valor));
}

/** Los únicos bloques de portada que se pueden guardar. */
function gg_claves_contenido(): array
{
    return ['hero', 'benefits', 'sections'];
}

/**
 * Los interruptores de secciones, en el orden en que bajan por la portada.
 *
 * La lista vive AQUÍ, en el código, y no se deduce de lo que llega: así el
 * navegador no puede inventarse claves nuevas ni llenar la tabla de opciones
 * con basura, y la forma guardada siempre encaja con `SectionToggles`.
 */
function gg_claves_secciones(): array
{
    return [
        'destacados',
        'categorias',
        'usados',
        'playstation',
        'nintendo',
        'consolas',
        'confianza',
        'whatsapp',
        'faq',
        'banner',
    ];
}

/** El abanico de la cabecera tiene exactamente cinco huecos. */
function gg_portadas_del_abanico(): int
{
    return 5;
}

/** Con más de seis beneficios la última fila de la rejilla queda coja. */
function gg_maximo_beneficios(): int
{
    return 6;
}

/**
 * Cabecera de la portada, reconstruida campo a campo.
 *
 * Se incluye `eyebrow` aunque el panel todavía no tenga un campo para él:
 * forma parte de la estructura que espera la tienda y el propio panel lo
 * reenvía tal como lo recibió. Si aquí se descartara, se borraría solo en
 * cuanto alguien guardara la cabecera.
 */
function gg_contenido_hero($valor): array
{
    if (!gg_es_objeto($valor)) {
        throw new GgError('La cabecera tiene que llegar como un objeto con sus campos.');
    }

    $hero = [
        'eyebrow'        => gg_texto($valor, 'eyebrow', 60),
        'title'          => gg_texto_obligatorio($valor, 'title', 70),
        'highlight'      => gg_texto($valor, 'highlight', 40),
        'subtitle'       => gg_texto($valor, 'subtitle', 200),
        'primaryLabel'   => gg_texto_obligatorio($valor, 'primaryLabel', 30),
        'primaryHref'    => gg_enlace($valor, 'primaryHref', '/catalogo'),
        'secondaryLabel' => gg_texto($valor, 'secondaryLabel', 30),
        'coverSlugs'     => [],
    ];

    // La tienda pinta ese botón con navegación interna: una dirección completa
    // (https://…) no navegaría a ninguna parte y dejaría el botón muerto.
    // `gg_enlace` ya descartó los `javascript:`; aquí se acota aún más.
    if (!str_starts_with($hero['primaryHref'], '/')) {
        throw new GgError(
            'El enlace del botón principal tiene que ser una ruta de la propia tienda y ' .
            'empezar por «/», por ejemplo /catalogo.'
        );
    }

    // Las portadas se guardan por SLUG de producto, no por ruta de imagen, así
    // que se pasan por el mismo saneador que genera los slugs: lo que llegue con
    // barras, puntos o etiquetas se queda en un slug inofensivo o se cae solo.
    $slugs = [];
    foreach (gg_lista($valor, 'coverSlugs', 12, 120) as $texto) {
        $slug = gg_slug($texto);
        if ($slug !== '') {
            $slugs[] = $slug;
        }
    }
    $slugs = array_values(array_unique($slugs));

    if (count($slugs) > gg_portadas_del_abanico()) {
        throw new GgError(
            'El abanico solo tiene sitio para ' . gg_portadas_del_abanico() . ' portadas.'
        );
    }
    $hero['coverSlugs'] = $slugs;

    return $hero;
}

/**
 * Nombre de icono de la franja de beneficios.
 *
 * Es el NOMBRE de un componente de lucide-react («Truck», «Gamepad2»), no un
 * texto que se lea en pantalla: se recorta a letras y dígitos para que por ahí
 * no pueda entrar nada más. Un nombre que la tienda no reconozca se pinta como
 * caja, que es exactamente lo que el panel avisa que va a pasar.
 */
function gg_icono_beneficio(string $nombre): string
{
    return substr(preg_replace('/[^A-Za-z0-9]/', '', $nombre) ?? '', 0, 40);
}

/** Franja de beneficios: lista de { icon, title, description }. */
function gg_contenido_beneficios($valor): array
{
    if (!is_array($valor) || !array_is_list($valor)) {
        throw new GgError('Los beneficios tienen que llegar como una lista.');
    }
    // Se rechaza en vez de recortar: recortar en silencio haría creer que se
    // guardaron seis cuando solo entraron los primeros.
    if (count($valor) > gg_maximo_beneficios()) {
        throw new GgError(
            'La franja admite como máximo ' . gg_maximo_beneficios() . ' beneficios.'
        );
    }

    $salida = [];
    foreach ($valor as $i => $item) {
        $numero = (int) $i + 1;
        if (!gg_es_objeto($item)) {
            throw new GgError("El beneficio $numero no tiene el formato esperado.");
        }
        $titulo = gg_texto($item, 'title', 40);
        if ($titulo === '') {
            // Un beneficio sin título sale como un hueco en la tira de la
            // portada, así que se corta aquí y no en la tienda.
            throw new GgError("El beneficio $numero necesita un título.");
        }
        $salida[] = [
            'icon'        => gg_icono_beneficio(gg_texto($item, 'icon', 40)),
            'title'       => $titulo,
            'description' => gg_texto($item, 'description', 60),
        ];
    }
    return $salida;
}

/** Interruptores de secciones: solo las claves conocidas, y solo booleanos. */
function gg_contenido_secciones($valor): array
{
    if (!gg_es_objeto($valor)) {
        throw new GgError('Las secciones tienen que llegar como un objeto de interruptores.');
    }

    $salida = [];
    foreach (gg_claves_secciones() as $clave) {
        // Se recorre la lista del código, no lo que manda el navegador: una
        // clave que falte queda encendida, que es como se ve la tienda hoy.
        // Apagar una sección tiene que ser un acto explícito.
        $salida[$clave] = gg_bool_entrada($valor, $clave, true);
    }
    return $salida;
}

/**
 * Qué cambió dentro de un bloque de portada, para el historial.
 *
 * Se compara con `json_encode` en vez de convertir a texto: aquí hay listas y
 * booleanos, y convertirlos a cadena los rompería (`(string) []` ni siquiera es
 * una comparación válida). Las listas —los beneficios— se guardan enteras: sus
 * posiciones cambian de sitio al reordenar y numerarlas confundiría más que
 * ayudar.
 */
function gg_diferencia_contenido($antes, $despues): array
{
    if (json_encode($antes) === json_encode($despues)) {
        return [];
    }
    if (!is_array($antes) || !is_array($despues) || array_is_list($despues)) {
        return ['valor' => ['antes' => $antes, 'ahora' => $despues]];
    }

    $dif = [];
    foreach ($despues as $clave => $nuevo) {
        $viejo = $antes[$clave] ?? null;
        if (json_encode($viejo) === json_encode($nuevo)) {
            continue;
        }
        $dif[$clave] = ['antes' => $viejo, 'ahora' => $nuevo];
    }
    return $dif;
}

/** Nombre legible del bloque, para que el historial se pueda leer. */
function gg_etiqueta_contenido(string $clave): string
{
    return match ($clave) {
        'hero'     => 'Cabecera de la portada',
        'benefits' => 'Franja de beneficios',
        'sections' => 'Secciones visibles de la portada',
        default    => $clave,
    };
}

/**
 * Campo del navegador → columna de la tabla `banners`.
 *
 * Este mapa es la ÚNICA fuente de nombres de columna: nunca se toma un nombre
 * de lo que llega en la petición.
 */
function gg_columnas_banner(): array
{
    return [
        'title'     => 'titulo',
        'subtitle'  => 'subtitulo',
        'imageUrl'  => 'imagen',
        'ctaLabel'  => 'cta_texto',
        'ctaHref'   => 'cta_enlace',
        'startsAt'  => 'desde',
        'endsAt'    => 'hasta',
        'active'    => 'activo',
        'sortOrder' => 'orden',
    ];
}

/** Valor ya validado de un campo de banner. */
function gg_valor_banner(string $campo, array $cuerpo)
{
    return match ($campo) {
        'title'    => gg_texto_obligatorio($cuerpo, 'title', 80),
        'subtitle' => gg_texto($cuerpo, 'subtitle', 140),
        // Vacío se guarda como NULL, no como cadena vacía: la tienda pregunta
        // «¿hay imagen?» y una cadena vacía respondería que sí.
        'imageUrl'  => gg_enlace($cuerpo, 'imageUrl', '') ?: null,
        'ctaLabel'  => gg_texto($cuerpo, 'ctaLabel', 30),
        'ctaHref'   => gg_enlace($cuerpo, 'ctaHref', '/catalogo'),
        'startsAt'  => gg_fecha($cuerpo, 'startsAt'),
        'endsAt'    => gg_fecha($cuerpo, 'endsAt'),
        'active'    => gg_bool_entrada($cuerpo, 'active', true) ? 1 : 0,
        'sortOrder' => gg_entero($cuerpo, 'sortOrder', 0, 9999) ?? 0,
        // Inalcanzable mientras el mapa de columnas mande, y por eso mismo se
        // deja: si algún día se añade un campo al mapa y se olvida aquí, falla
        // con un mensaje claro en vez de guardar un valor sin validar.
        default => throw new GgError("El campo «$campo» no se puede guardar aquí."),
    };
}

/**
 * La ventana de fechas tiene que tener sentido.
 *
 * Las dos fechas se guardan siempre con el mismo formato ISO en UTC
 * («2026-08-25T14:00:00Z»), que `gg_fecha` impone: con largo fijo y de mayor a
 * menor unidad, comparar los textos ordena igual que comparar los instantes.
 */
function gg_exigir_ventana(?string $desde, ?string $hasta): void
{
    if ($desde !== null && $hasta !== null && $hasta <= $desde) {
        throw new GgError('La fecha de fin tiene que ser posterior a la de inicio.');
    }
}

/** Campo del navegador → columna de la tabla `preguntas`. */
function gg_columnas_pregunta(): array
{
    return [
        'question'  => 'pregunta',
        'answer'    => 'respuesta',
        'sortOrder' => 'orden',
        'active'    => 'activa',
    ];
}

function gg_valor_pregunta(string $campo, array $cuerpo)
{
    return match ($campo) {
        'question'  => gg_texto_obligatorio($cuerpo, 'question', 200),
        'answer'    => gg_texto_obligatorio($cuerpo, 'answer', 2000),
        'sortOrder' => gg_entero($cuerpo, 'sortOrder', 0, 9999) ?? 0,
        'active'    => gg_bool_entrada($cuerpo, 'active', true) ? 1 : 0,
        default     => throw new GgError("El campo «$campo» no se puede guardar aquí."),
    };
}

/** Las preguntas tal como se ven en la portada, de la primera a la última. */
function gg_lista_preguntas(bool $todas): array
{
    $sql = $todas
        ? 'SELECT * FROM preguntas ORDER BY orden ASC, creado ASC'
        : 'SELECT * FROM preguntas WHERE activa = 1 ORDER BY orden ASC, creado ASC';
    return array_map('gg_salida_pregunta', gg_filas($sql));
}

// ═════════════════════════════════════════════════════════════════════════════
// CONTENIDO DE LA PORTADA
// ═════════════════════════════════════════════════════════════════════════════

if ($recurso === 'contenido') {
    // ── GET /api/contenido ───────────────────────────────────────────────────
    // Se devuelve lo que hay guardado, sin rellenar huecos: los valores por
    // omisión de la portada viven en la interfaz, y ponerlos aquí también daría
    // dos verdades distintas para lo mismo.
    if ($seccion === '' && $metodo === 'GET') {
        gg_exigir_sesion();
        gg_responder(['contenido' => gg_opciones('contenido')]);
    }

    // ── PUT /api/contenido/{clave} ───────────────────────────────────────────
    if ($seccion !== '' && $metodo === 'PUT') {
        gg_exigir_rol('editor');

        if (!in_array($seccion, gg_claves_contenido(), true)) {
            gg_error(
                'Ese bloque de la portada no existe. Solo se pueden guardar: ' .
                implode(', ', gg_claves_contenido()) . '.',
                400
            );
        }
        if (!array_key_exists('valor', $cuerpo)) {
            gg_error('Falta el campo «valor» con el contenido que hay que guardar.');
        }

        $nuevo = match ($seccion) {
            'hero'     => gg_contenido_hero($cuerpo['valor']),
            'benefits' => gg_contenido_beneficios($cuerpo['valor']),
            'sections' => gg_contenido_secciones($cuerpo['valor']),
        };

        $antes = gg_opciones('contenido')[$seccion] ?? [];
        gg_guardar_opcion('contenido', $seccion, $nuevo);

        $dif = gg_diferencia_contenido($antes, $nuevo);
        if ($dif) {
            gg_auditar('actualizar', 'contenido', $seccion, gg_etiqueta_contenido($seccion), $dif);
        }

        // Se devuelve el grupo entero, no solo el bloque tocado: el panel se
        // queda con una foto completa y coherente de la portada.
        gg_responder(['contenido' => gg_opciones('contenido')]);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// BANNERS
// ═════════════════════════════════════════════════════════════════════════════

if ($recurso === 'banners') {
    // ── GET /api/banners ─────────────────────────────────────────────────────
    if ($seccion === '' && $metodo === 'GET') {
        gg_exigir_sesion();

        if (gg_bandera('todos')) {
            // El panel los administra todos, incluidos los apagados y los que ya
            // caducaron: si no se vieran, no habría forma de reactivarlos.
            $filas = gg_filas('SELECT * FROM banners ORDER BY orden ASC, creado ASC');
        } else {
            $ahora = gg_ahora();
            $filas = gg_filas(
                'SELECT * FROM banners
                 WHERE activo = 1
                   AND (desde IS NULL OR desde <= ?)
                   AND (hasta IS NULL OR hasta >= ?)
                 ORDER BY orden ASC, creado ASC',
                [$ahora, $ahora]
            );
        }

        gg_responder(['banners' => array_map('gg_salida_banner', $filas)]);
    }

    // ── POST /api/banners ────────────────────────────────────────────────────
    if ($seccion === '' && $metodo === 'POST') {
        gg_exigir_rol('editor');

        $datos = [];
        foreach (gg_columnas_banner() as $campo => $columna) {
            $datos[$columna] = gg_valor_banner($campo, $cuerpo);
        }
        gg_exigir_ventana($datos['desde'], $datos['hasta']);

        $id = gg_id();
        $ahora = gg_ahora();
        gg_insertar('banners', [
            'id' => $id,
            ...$datos,
            'creado'      => $ahora,
            'actualizado' => $ahora,
        ]);

        gg_auditar('crear', 'banners', $id, $datos['titulo']);

        $fila = gg_fila('SELECT * FROM banners WHERE id = ?', [$id]);
        gg_responder(['banner' => gg_salida_banner($fila)], 201);
    }

    // ── PATCH /api/banners/{id} ──────────────────────────────────────────────
    if ($seccion !== '' && $metodo === 'PATCH') {
        gg_exigir_rol('editor');

        $fila = gg_fila('SELECT * FROM banners WHERE id = ?', [$seccion]);
        if (!$fila) {
            throw new GgError('Ese banner ya no existe.', 404);
        }

        // Edición parcial: solo se tocan las columnas cuyo campo llegó de
        // verdad. Rellenar las ausentes con valores por omisión borraría lo que
        // el panel ni siquiera envió.
        $datos = [];
        foreach (gg_columnas_banner() as $campo => $columna) {
            if (!array_key_exists($campo, $cuerpo)) {
                continue;
            }
            $datos[$columna] = gg_valor_banner($campo, $cuerpo);
        }

        if (!$datos) {
            gg_responder(['banner' => gg_salida_banner($fila)]);
        }

        // Se comprueba la ventana ya combinada con lo que había. Con `??` no
        // valdría: vaciar una fecha manda null, y `??` volvería a coger la
        // fecha vieja, comparando contra algo que se acaba de borrar.
        $desde = array_key_exists('desde', $datos) ? $datos['desde'] : $fila['desde'];
        $hasta = array_key_exists('hasta', $datos) ? $datos['hasta'] : $fila['hasta'];
        gg_exigir_ventana($desde, $hasta);

        $datos['actualizado'] = gg_ahora();
        gg_actualizar('banners', $seccion, $datos);

        $nueva = gg_fila('SELECT * FROM banners WHERE id = ?', [$seccion]);
        // Otro administrador pudo borrarlo entre la lectura y la escritura. Sin
        // esta comprobación se leería un campo sobre null y el panel recibiría
        // un «error inesperado» en vez de enterarse de que ya no existe.
        if (!$nueva) {
            throw new GgError('Ese banner ya no existe.', 404);
        }
        gg_auditar_cambio('banners', $seccion, $nueva['titulo'], $fila, $nueva);

        gg_responder(['banner' => gg_salida_banner($nueva)]);
    }

    // ── DELETE /api/banners/{id} ─────────────────────────────────────────────
    // Borrar es de administrador: un editor puede apagar el banner, que deshace
    // igual de rápido y no pierde el trabajo hecho.
    if ($seccion !== '' && $metodo === 'DELETE') {
        gg_exigir_rol('admin');

        $fila = gg_fila('SELECT * FROM banners WHERE id = ?', [$seccion]);
        if (!$fila) {
            throw new GgError('Ese banner ya no existe.', 404);
        }

        gg_ejecutar('DELETE FROM banners WHERE id = ?', [$seccion]);
        // El registro guarda cómo era: es lo único que queda de un banner
        // borrado, y sin eso el historial no sirve para reconstruir nada.
        gg_auditar('eliminar', 'banners', $seccion, $fila['titulo'], [
            'banner' => ['antes' => gg_salida_banner($fila), 'ahora' => null],
        ]);

        gg_responder(['ok' => true]);
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// PREGUNTAS FRECUENTES
// ═════════════════════════════════════════════════════════════════════════════

if ($recurso === 'preguntas') {
    // ── GET /api/preguntas ───────────────────────────────────────────────────
    if ($seccion === '' && $metodo === 'GET') {
        gg_exigir_sesion();
        gg_responder(['preguntas' => gg_lista_preguntas(gg_bandera('todas'))]);
    }

    // ── POST /api/preguntas ──────────────────────────────────────────────────
    if ($seccion === '' && $metodo === 'POST') {
        gg_exigir_rol('editor');

        $datos = [];
        foreach (gg_columnas_pregunta() as $campo => $columna) {
            $datos[$columna] = gg_valor_pregunta($campo, $cuerpo);
        }

        $id = gg_id();
        $ahora = gg_ahora();
        gg_insertar('preguntas', [
            'id' => $id,
            ...$datos,
            'creado'      => $ahora,
            'actualizado' => $ahora,
        ]);

        gg_auditar('crear', 'preguntas', $id, $datos['pregunta']);

        $fila = gg_fila('SELECT * FROM preguntas WHERE id = ?', [$id]);
        gg_responder(['pregunta' => gg_salida_pregunta($fila)], 201);
    }

    // ── POST /api/preguntas/orden ────────────────────────────────────────────
    // Va antes que las rutas con id para que «orden» no se confunda con uno.
    if ($seccion === 'orden' && $metodo === 'POST') {
        gg_exigir_rol('editor');

        $ids = gg_lista($cuerpo, 'ids', 300, 60);
        if (!$ids) {
            gg_error('No llegó ninguna pregunta que ordenar.');
        }

        $db = gg_db();
        $db->beginTransaction();
        try {
            // La foto del orden anterior se toma DENTRO de la transacción: si se
            // tomara antes, otra pestaña podría reordenar entremedias y el
            // historial guardaría un «antes» que ya no era el de verdad.
            $antes = array_column(
                gg_filas('SELECT id FROM preguntas ORDER BY orden ASC, creado ASC'),
                'id'
            );

            $ahora = gg_ahora();
            $posicion = 0;
            foreach ($ids as $id) {
                $tocadas = gg_ejecutar(
                    'UPDATE preguntas SET orden = ?, actualizado = ? WHERE id = ?',
                    [$posicion, $ahora, $id]
                );
                // Un id que ya no existe (borrado desde otra pestaña) no debe
                // consumir una posición y dejar un hueco en la numeración.
                if ($tocadas > 0) {
                    $posicion++;
                }
            }
            // Todo o nada: un reordenamiento a medias deja la portada con dos
            // preguntas en la misma posición y un orden que nadie pidió.
            $db->commit();
        } catch (Throwable $e) {
            $db->rollBack();
            throw $e;
        }

        // Se devuelve la lista ya ordenada para que el panel no tenga que
        // adivinar cómo quedó. El panel manda SIEMPRE la lista completa; si aun
        // así quedara alguna fuera (creada desde otra pestaña mientras tanto),
        // conserva su posición anterior y el desempate por fecha de creación
        // deja el orden estable en vez de aleatorio.
        $preguntas = gg_lista_preguntas(true);
        $despues = array_column($preguntas, 'id');

        // El historial anota el orden que quedó DE VERDAD, no el que se pidió:
        // los ids que ya no existen se saltan, así que guardar la lista recibida
        // dejaría escrito un orden que nunca llegó a aplicarse. Si al final no
        // se movió nada —porque ninguno de esos ids existe ya—, no hay cambio
        // que registrar.
        if ($antes !== $despues) {
            gg_auditar('actualizar', 'preguntas', null, 'Reordenó las preguntas frecuentes', [
                'orden' => ['antes' => $antes, 'ahora' => $despues],
            ]);
        }

        gg_responder(['preguntas' => $preguntas]);
    }

    // ── PATCH /api/preguntas/{id} ────────────────────────────────────────────
    if ($seccion !== '' && $metodo === 'PATCH') {
        gg_exigir_rol('editor');

        $fila = gg_fila('SELECT * FROM preguntas WHERE id = ?', [$seccion]);
        if (!$fila) {
            throw new GgError('Esa pregunta ya no existe.', 404);
        }

        $datos = [];
        foreach (gg_columnas_pregunta() as $campo => $columna) {
            if (!array_key_exists($campo, $cuerpo)) {
                continue;
            }
            $datos[$columna] = gg_valor_pregunta($campo, $cuerpo);
        }

        if (!$datos) {
            gg_responder(['pregunta' => gg_salida_pregunta($fila)]);
        }

        $datos['actualizado'] = gg_ahora();
        gg_actualizar('preguntas', $seccion, $datos);

        $nueva = gg_fila('SELECT * FROM preguntas WHERE id = ?', [$seccion]);
        // Igual que con los banners: si se borró desde otra pestaña mientras se
        // guardaba, se dice que ya no existe en vez de romper sobre null.
        if (!$nueva) {
            throw new GgError('Esa pregunta ya no existe.', 404);
        }
        gg_auditar_cambio('preguntas', $seccion, $nueva['pregunta'], $fila, $nueva);

        gg_responder(['pregunta' => gg_salida_pregunta($nueva)]);
    }

    // ── DELETE /api/preguntas/{id} ───────────────────────────────────────────
    if ($seccion !== '' && $metodo === 'DELETE') {
        gg_exigir_rol('admin');

        $fila = gg_fila('SELECT * FROM preguntas WHERE id = ?', [$seccion]);
        if (!$fila) {
            throw new GgError('Esa pregunta ya no existe.', 404);
        }

        gg_ejecutar('DELETE FROM preguntas WHERE id = ?', [$seccion]);
        gg_auditar('eliminar', 'preguntas', $seccion, $fila['pregunta'], [
            'pregunta' => ['antes' => gg_salida_pregunta($fila), 'ahora' => null],
        ]);

        gg_responder(['ok' => true]);
    }
}

gg_error('No existe esa dirección en la API.', 404);

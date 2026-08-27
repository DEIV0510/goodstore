<?php
declare(strict_types=1);

/**
 * /api/categorias/...
 *
 * Las tarjetas de «Explora por categoría». Son contenido editorial, no la
 * clasificación de un producto: aquí se decide qué se anuncia en la portada, en
 * qué orden y con qué portadas.
 *
 * Detalle que explica media lógica de este archivo: las portadas se guardan por
 * SLUG de producto, nunca por ruta de imagen. Si mañana se cambia la foto de un
 * juego, la tarjeta se actualiza sola; si se guardara la ruta, quedaría
 * apuntando a un archivo que ya no existe.
 */

$segmento = $ruta[1] ?? '';
$metodo = gg_metodo();
$cuerpo = in_array($metodo, ['POST', 'PATCH'], true) ? gg_cuerpo() : [];

// ─────────────────────────────────────────────────────────────────────────────
// Ayudas propias de estas rutas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Devuelve un slug libre, añadiendo «-2», «-3»… si ya está ocupado.
 *
 * Se comprueba antes de insertar en vez de confiar en el UNIQUE de la tabla
 * porque el choque llegaría al panel como «error de base de datos», y lo que el
 * administrador necesita es que se resuelva solo, sin entender qué pasó.
 *
 * El slug SIEMPRE se recalcula aquí: el que manda el navegador es una
 * sugerencia. Aceptarlo tal cual permitiría meter barras o puntos y sacar la
 * dirección de donde debe estar.
 */
function gg_categorias_slug_libre(string $deseado, ?string $exceptoId = null): string
{
    $base = gg_slug($deseado);
    if ($base === '') {
        // Un título escrito solo con signos, o con un alfabeto que iconv no sabe
        // transliterar, dejaría el slug vacío. Y un slug vacío rompe la URL.
        $base = 'categoria';
    }

    // El «id <> ?» con cadena vacía sirve para el alta: ninguna fila tiene id
    // vacío, así que la comparación no excluye nada. Evita tener dos consultas
    // distintas para el mismo control.
    $exceptoId = $exceptoId ?? '';

    $candidato = $base;
    // El tope corta un bucle infinito si otra petición estuviera insertando a la
    // vez. Nunca debería llegarse ni de lejos.
    for ($n = 2; $n < 500; $n++) {
        $ocupado = gg_valor(
            'SELECT id FROM categorias WHERE slug = ? AND id <> ?',
            [$candidato, $exceptoId]
        );
        if ($ocupado === null) {
            return $candidato;
        }
        $candidato = $base . '-' . $n;
    }

    throw new GgError('No se pudo generar una dirección única para esta categoría.', 409);
}

/** La categoría o un 404 claro. Nunca se sigue trabajando sobre una fila que no está. */
function gg_categorias_exigir(string $id): array
{
    $fila = gg_fila('SELECT * FROM categorias WHERE id = ?', [$id]);
    if (!$fila) {
        throw new GgError('Esa categoría ya no existe.', 404);
    }
    return $fila;
}

/**
 * Lista de slugs de portada lista para guardar, como TEXT con JSON.
 *
 * Cada elemento vuelve a pasar por gg_slug: aunque venga de un desplegable del
 * panel, lo que llega es texto de internet y termina dentro de una comparación
 * contra la tabla de productos.
 */
function gg_categorias_portadas_entrada(array $datos): string
{
    $slugs = [];
    foreach (gg_lista($datos, 'coverSlugs', 24, 140) as $item) {
        $limpio = gg_slug($item);
        if ($limpio !== '') {
            $slugs[] = $limpio;
        }
    }
    return json_encode(array_values(array_unique($slugs)), JSON_UNESCAPED_UNICODE) ?: '[]';
}

/**
 * Mapa slug → imagen, pero SOLO de los slugs que hacen falta.
 *
 * Para responder con una sola categoría no se usa gg_portadas_por_slug(),
 * porque esa lee el catálogo entero (cientos de filas) para acabar resolviendo
 * tres o cuatro portadas. En el listado sí conviene la otra: allí una lectura
 * completa sirve para todas las tarjetas a la vez.
 */
function gg_categorias_portadas_de(array $slugs): array
{
    $slugs = array_values(array_unique(array_filter(
        $slugs,
        static fn($s) => is_string($s) && $s !== ''
    )));
    if (!$slugs) {
        return [];
    }

    // Los huecos se arman con el NÚMERO de slugs, nunca con su contenido: los
    // valores siguen viajando como parámetros de la consulta preparada.
    $huecos = implode(', ', array_fill(0, count($slugs), '?'));

    $mapa = [];
    foreach (gg_filas('SELECT slug, imagenes FROM productos WHERE slug IN (' . $huecos . ')', $slugs) as $f) {
        $imagenes = gg_json($f['imagenes']);
        if ($imagenes) {
            $mapa[$f['slug']] = $imagenes[0];
        }
    }
    return $mapa;
}

/** Respuesta de una sola categoría, con sus portadas ya resueltas. */
function gg_categorias_respuesta(array $fila): array
{
    return gg_salida_categoria($fila, gg_categorias_portadas_de((array) gg_json($fila['portadas'])));
}

/**
 * Imagen propia de la tarjeta: ruta del sitio o URL http(s), o null si no hay.
 *
 * Pasa por gg_enlace para que un «javascript:…» guardado desde el panel no
 * pueda acabar dentro de un src en la tienda.
 */
function gg_categorias_imagen(array $datos): ?string
{
    $valor = gg_enlace($datos, 'imageUrl', '');
    return $valor === '' ? null : $valor;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/categorias — listado para el panel
//
// Pide sesión aunque las categorías activas sean públicas: la tienda ya las
// recibe en /api/publico. Esta ruta devuelve además las inactivas y las de
// «próximamente», que son planes del negocio y no se enseñan fuera.
// ─────────────────────────────────────────────────────────────────────────────
if ($segmento === '' && $metodo === 'GET') {
    gg_exigir_sesion();

    $todas = gg_bool_entrada($_GET, 'todas');

    // Dos consultas escritas enteras en vez de pegar el WHERE con texto: la
    // condición la decide el código, jamás lo que venga en la dirección.
    $filas = $todas
        ? gg_filas('SELECT * FROM categorias ORDER BY orden ASC, titulo ASC')
        : gg_filas('SELECT * FROM categorias WHERE activa = 1 ORDER BY orden ASC, titulo ASC');

    // Una sola lectura del catálogo para TODAS las tarjetas. Resolver las
    // portadas dentro del bucle costaría una lectura completa por categoría.
    $portadas = gg_portadas_por_slug();

    gg_responder([
        'categorias' => array_map(
            static fn($f) => gg_salida_categoria($f, $portadas),
            $filas
        ),
    ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/categorias/orden — reordenar
//
// Va antes que el alta porque comparten método: «orden» es una acción, no el
// identificador de una categoría.
// ─────────────────────────────────────────────────────────────────────────────
if ($segmento === 'orden' && $metodo === 'POST') {
    gg_exigir_rol('editor');

    $ids = gg_lista($cuerpo, 'ids', 300, 60);
    if (!$ids) {
        throw new GgError('No llegó ninguna categoría que ordenar.');
    }

    $db = gg_db();
    $ahora = gg_ahora();
    $movidas = 0;

    // Todo o nada: si fallara a mitad de la lista, la portada quedaría con un
    // orden mezclado y sin manera de saber cuál era el bueno.
    $db->beginTransaction();
    try {
        // gg_lista ya devolvió la lista sin repetidos y con índices seguidos,
        // así que la posición del array ES el orden que se quiere guardar.
        foreach ($ids as $posicion => $idCategoria) {
            $movidas += gg_ejecutar(
                'UPDATE categorias SET orden = ?, actualizado = ? WHERE id = ?',
                [$posicion, $ahora, $idCategoria]
            );
        }
        $db->commit();
    } catch (Throwable $e) {
        $db->rollBack();
        throw $e;
    }

    // Un id que ya no existe (panel abierto desde antes de un borrado) se
    // ignora sin ruido: el resto de la lista sí se ordena. Pero si no encajó
    // ninguno, lo que llegó no era una lista de categorías y hay que decirlo.
    if ($movidas === 0) {
        throw new GgError('Ninguna de esas categorías existe.', 404);
    }

    gg_auditar('actualizar', 'categorias', null, 'Reordenó las categorías', [
        'movidas'   => $movidas,
        'recibidas' => count($ids),
    ]);

    gg_responder(['ok' => true]);
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/categorias — crear
// ─────────────────────────────────────────────────────────────────────────────
if ($segmento === '' && $metodo === 'POST') {
    gg_exigir_rol('editor');

    $titulo = gg_texto_obligatorio($cuerpo, 'title', 120);
    $slug = gg_categorias_slug_libre(gg_texto($cuerpo, 'slug', 140) ?: $titulo);

    $orden = gg_entero($cuerpo, 'sortOrder', 0, 9999);
    if ($orden === null) {
        // Sin posición indicada, la nueva va al final. Colocarla en el 0
        // reordenaría la portada entera sin que nadie lo haya pedido.
        $maximo = gg_valor('SELECT MAX(orden) FROM categorias');
        $orden = $maximo === null ? 0 : (int) $maximo + 1;
    }

    $id = gg_id();
    $ahora = gg_ahora();

    gg_insertar('categorias', [
        'id'          => $id,
        'slug'        => $slug,
        'titulo'      => $titulo,
        'subtitulo'   => gg_texto($cuerpo, 'subtitle', 200),
        'descripcion' => gg_texto($cuerpo, 'description', 1000),
        'enlace'      => gg_enlace($cuerpo, 'href'),
        'imagen'      => gg_categorias_imagen($cuerpo),
        'portadas'    => gg_categorias_portadas_entrada($cuerpo),
        'orden'       => $orden,
        // Los booleanos se guardan como 0/1: SQLite no tiene tipo booleano.
        'activa'      => gg_bool_entrada($cuerpo, 'active', true) ? 1 : 0,
        'proximo'     => gg_bool_entrada($cuerpo, 'soon', false) ? 1 : 0,
        'creado'      => $ahora,
        'actualizado' => $ahora,
    ]);

    gg_auditar('crear', 'categorias', $id, $titulo, ['slug' => $slug]);

    gg_responder(['categoria' => gg_categorias_respuesta(gg_categorias_exigir($id))], 201);
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/categorias/{id} — editar
//
// Edición parcial de verdad: se toca solo lo que venga en el cuerpo. Por eso se
// mira con array_key_exists y no con isset — con isset, mandar null para
// «quitar la imagen» no haría nada, porque isset(null) es false.
// ─────────────────────────────────────────────────────────────────────────────
if ($segmento !== '' && $segmento !== 'orden' && $metodo === 'PATCH') {
    gg_exigir_rol('editor');
    $antes = gg_categorias_exigir($segmento);

    $cambios = [];

    if (array_key_exists('title', $cuerpo)) {
        $cambios['titulo'] = gg_texto_obligatorio($cuerpo, 'title', 120);
    }

    if (array_key_exists('slug', $cuerpo)) {
        // La dirección solo cambia si la piden explícitamente. Cambiar el título
        // NO la mueve: los enlaces que el negocio ya compartió por WhatsApp
        // dejarían de funcionar de un día para otro.
        $cambios['slug'] = gg_categorias_slug_libre(
            gg_texto($cuerpo, 'slug', 140) ?: ($cambios['titulo'] ?? (string) $antes['titulo']),
            (string) $antes['id']
        );
    }

    if (array_key_exists('subtitle', $cuerpo)) {
        $cambios['subtitulo'] = gg_texto($cuerpo, 'subtitle', 200);
    }

    if (array_key_exists('description', $cuerpo)) {
        $cambios['descripcion'] = gg_texto($cuerpo, 'description', 1000);
    }

    if (array_key_exists('href', $cuerpo)) {
        // Si llega vacío se conserva el enlace que ya tenía: una tarjeta sin
        // destino sería un botón que no lleva a ninguna parte.
        $cambios['enlace'] = gg_enlace($cuerpo, 'href', (string) $antes['enlace']);
    }

    if (array_key_exists('imageUrl', $cuerpo)) {
        $cambios['imagen'] = gg_categorias_imagen($cuerpo);
    }

    if (array_key_exists('coverSlugs', $cuerpo)) {
        $cambios['portadas'] = gg_categorias_portadas_entrada($cuerpo);
    }

    if (array_key_exists('sortOrder', $cuerpo)) {
        $orden = gg_entero($cuerpo, 'sortOrder', 0, 9999);
        // Un null aquí significa «sin posición», y la columna no admite vacío:
        // se deja la que ya tenía en vez de fallar.
        if ($orden !== null) {
            $cambios['orden'] = $orden;
        }
    }

    if (array_key_exists('active', $cuerpo)) {
        // El valor actual como respaldo: si llegara algo que no es un booleano,
        // el estado se queda como está en lugar de apagarse solo.
        $cambios['activa'] = gg_bool_entrada($cuerpo, 'active', gg_bool($antes['activa'])) ? 1 : 0;
    }

    if (array_key_exists('soon', $cuerpo)) {
        $cambios['proximo'] = gg_bool_entrada($cuerpo, 'soon', gg_bool($antes['proximo'])) ? 1 : 0;
    }

    if (!$cambios) {
        // Guardar sin cambiar nada no es un error: se devuelve la categoría tal
        // como está y no se ensucia el historial con una entrada vacía.
        gg_responder(['categoria' => gg_categorias_respuesta($antes)]);
    }

    $cambios['actualizado'] = gg_ahora();
    gg_actualizar('categorias', (string) $antes['id'], $cambios);

    // Registra solo lo que cambió de verdad, con el valor anterior y el nuevo.
    gg_auditar_cambio(
        'categorias',
        (string) $antes['id'],
        $cambios['titulo'] ?? (string) $antes['titulo'],
        $antes,
        $cambios
    );

    gg_responder(['categoria' => gg_categorias_respuesta(gg_categorias_exigir((string) $antes['id']))]);
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/categorias/{id} — borrar
//
// Pide rol de administrador: un editor puede rehacer un texto mal escrito, pero
// una tarjeta borrada hay que volver a montarla entera, con sus portadas.
// ─────────────────────────────────────────────────────────────────────────────
if ($segmento !== '' && $segmento !== 'orden' && $metodo === 'DELETE') {
    gg_exigir_rol('admin');
    $fila = gg_categorias_exigir($segmento);

    gg_ejecutar('DELETE FROM categorias WHERE id = ?', [$fila['id']]);

    // Se guarda el contenido en el historial, no solo el identificador: es lo
    // único que queda para reconstruirla si el borrado fue un accidente.
    gg_auditar('eliminar', 'categorias', (string) $fila['id'], (string) $fila['titulo'], [
        'slug'     => $fila['slug'],
        'enlace'   => $fila['enlace'],
        'portadas' => gg_json($fila['portadas']),
    ]);

    gg_responder(['ok' => true]);
}

gg_error('No existe esa dirección en la API.', 404);

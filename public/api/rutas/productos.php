<?php
declare(strict_types=1);

/**
 * /api/productos/...
 *
 * El catálogo: la pantalla más usada del panel y la única parte de la API que
 * además acepta una escritura desde la tienda pública (el contador de vistas).
 * Por eso cada ruta declara su rol de forma explícita, aunque se repita.
 *
 * Los nombres que entran y salen son los de la interfaz (en inglés), porque son
 * los que ya usaban las 16 pantallas del panel. La traducción a columnas de la
 * base ocurre solo en dos sitios: aquí al entrar y en salidas.php al salir.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Listas cerradas
//
// Todo valor que no esté en estas listas se rechaza antes de tocar la base. Es
// lo que impide que un desplegable manipulado desde la consola del navegador
// guarde una plataforma inventada que después la tienda no sabría dibujar.
// ─────────────────────────────────────────────────────────────────────────────

const GG_PROD_PLATAFORMAS = ['ps5', 'ps4', 'switch', 'switch2', 'xbox'];
const GG_PROD_CATEGORIAS  = ['videojuegos', 'consolas', 'accesorios'];
const GG_PROD_GENEROS     = [
    'accion', 'aventura', 'rpg', 'terror', 'deportes',
    'carreras', 'familiar', 'plataformas', 'lucha',
];
const GG_PROD_COPIAS   = ['nuevo', 'usado', 'consultar'];
const GG_PROD_REGIONES = ['america', 'europa', 'japon', 'asia'];
const GG_PROD_ESTADOS  = ['publicado', 'borrador', 'archivado'];

/**
 * Topes de sanidad. No son reglas del negocio, son redes: atrapan el cero de
 * más al teclear un precio y la lista de imágenes disparatada de un script.
 */
const GG_PROD_PRECIO_MAX  = 100000000;
const GG_PROD_STOCK_MAX   = 100000;
const GG_PROD_IMAGENES_MAX = 12;

// ─────────────────────────────────────────────────────────────────────────────
// Ayudas de este archivo
// ─────────────────────────────────────────────────────────────────────────────

/** Producto por id, o 404. Devuelve la fila cruda, no la salida JSON. */
function gg_prod_exigir(string $id): array
{
    $fila = gg_fila('SELECT * FROM productos WHERE id = ?', [$id]);
    if (!$fila) {
        throw new GgError('No se encontró ese producto.', 404);
    }
    return $fila;
}

/**
 * ¿Ese slug ya lo usa otro producto?
 *
 * $excluir deja fuera al producto que se está editando: sin eso, guardar un
 * producto sin cambiarle el nombre chocaría consigo mismo y se renombraría solo
 * a «zelda-2» cada vez que se toca cualquier campo.
 */
function gg_prod_slug_ocupado(string $slug, ?string $excluir = null): bool
{
    $fila = gg_fila('SELECT id FROM productos WHERE slug = ?', [$slug]);
    return $fila !== null && $fila['id'] !== $excluir;
}

/**
 * Slug libre a partir de un texto.
 *
 * Se recalcula SIEMPRE con gg_slug(): aceptar el del navegador tal cual
 * permitiría meter barras o puntos y salirse de la ruta esperada. Si ya está
 * ocupado se prueba -2, -3... hasta encontrar uno libre.
 */
function gg_prod_slug_unico(string $base, ?string $excluir = null): string
{
    $raiz = gg_slug($base);
    if ($raiz === '') {
        // El nombre podía ser solo símbolos o caracteres de otro alfabeto y
        // gg_slug lo dejó vacío. Un slug vacío rompería la URL de la ficha.
        $raiz = 'producto';
    }

    $slug = $raiz;
    $n = 2;
    $intentos = 0;
    while (gg_prod_slug_ocupado($slug, $excluir)) {
        $intentos++;
        // El candidato nuevo vuelve a pasar por la condición del while: nunca se
        // devuelve un slug sin haber comprobado que está libre. Salir del bucle
        // con uno sin comprobar chocaría contra el UNIQUE de la tabla y el panel
        // vería un «error de base de datos» en vez de un producto guardado.
        $slug = $intentos <= 200
            ? $raiz . '-' . $n
            // Con cientos de homónimos es más barato cerrar con un sufijo
            // aleatorio que seguir probando -201, -202...
            : $raiz . '-' . bin2hex(random_bytes(3));
        $n++;

        if ($intentos > 210) {
            throw new GgError('No se pudo generar una dirección única para este producto.', 409);
        }
    }
    return $slug;
}

/**
 * El precio anterior es el que se pinta tachado en la ficha. Si no es mayor que
 * el actual no hay descuento que mostrar, y dejarlo pasar dibujaría una oferta
 * al revés (tachado más barato que el precio de venta).
 */
function gg_prod_validar_precios(?int $precio, ?int $precioAntes): void
{
    if ($precio !== null && $precioAntes !== null && $precioAntes <= $precio) {
        throw new GgError(
            'El precio anterior debe ser MAYOR que el precio actual: es el que se muestra tachado. ' .
            'Si el producto no está en oferta, deja el precio anterior vacío.'
        );
    }
}

/**
 * Rutas de imagen admitidas: internas («/medios/foo.webp») o http(s).
 *
 * Se filtra aquí y no en la interfaz porque el atributo src de la tienda acaba
 * recibiendo esto tal cual: un «javascript:» guardado desde el panel se
 * ejecutaría en el navegador de cada visitante.
 *
 * «Empieza por /» no basta para dar una ruta por interna: hay dos formas de
 * escribir una dirección de otro dominio que también empiezan por «/», y una
 * ruta interna con «..» acaba sirviendo un archivo que no es el que se eligió.
 */
function gg_prod_imagenes(array $cuerpo): array
{
    $salida = [];
    foreach (gg_lista($cuerpo, 'images', GG_PROD_IMAGENES_MAX, 400) as $img) {
        if (str_starts_with($img, '/')) {
            // «//otro-sitio.com/x.webp» (y su variante «/\otro-sitio.com», que
            // los navegadores tratan igual) NO es una ruta de este sitio: es una
            // dirección de otro dominio con el protocolo omitido. Colada como
            // portada, cada visitante de la tienda pediría la imagen a ese
            // servidor ajeno, que se queda con su IP y su navegador.
            if (str_starts_with($img, '//') || str_starts_with($img, '/\\')) {
                throw new GgError(
                    'Esa imagen apunta a otro dominio. Si es externa, escríbela completa ' .
                    'empezando por «https://»; si es del sitio, súbela desde Medios.'
                );
            }
            // Un «..» se sale de /medios y termina apuntando a otro archivo del
            // sitio. La ruta se guarda tal cual, así que se corta aquí.
            if (str_contains($img, '..')) {
                throw new GgError('La ruta de la imagen no puede contener «..».');
            }
            $salida[] = $img;
            continue;
        }

        if (preg_match('#^https?://#i', $img)) {
            $salida[] = $img;
            continue;
        }

        throw new GgError(
            'Cada imagen debe ser una ruta del sitio (que empiece por «/») o una dirección http(s)://.'
        );
    }
    return $salida;
}

/**
 * Traduce el cuerpo de la petición a columnas de la tabla, ya validadas.
 *
 * Con $parcial = true solo se devuelven las claves PRESENTES en el cuerpo, y la
 * comprobación se hace con array_key_exists y no con isset: isset da false
 * cuando el valor es null, y aquí null significa algo concreto («precio sin
 * confirmar», «sin género clasificado»), no «no me lo mandaron». Con isset,
 * vaciar un precio desde el panel sería imposible.
 *
 * El slug NO se resuelve aquí: necesita consultar la base y saber qué producto
 * hay que excluir de la comprobación, así que lo hace cada ruta.
 */
function gg_prod_columnas(array $c, bool $parcial): array
{
    $hay = static fn(string $clave): bool => !$parcial || array_key_exists($clave, $c);
    $cols = [];

    if ($hay('name')) {
        $cols['nombre'] = gg_texto_obligatorio($c, 'name', 200);
    }

    if ($hay('platform')) {
        $plataforma = gg_opcion($c, 'platform', GG_PROD_PLATAFORMAS);
        // La columna es NOT NULL: aquí no vale el null por omisión de
        // gg_opcion, hay que rechazarlo con un mensaje que se entienda.
        if ($plataforma === null) {
            throw new GgError(
                'Elige una plataforma. Las válidas son: ' . implode(', ', GG_PROD_PLATAFORMAS) . '.'
            );
        }
        $cols['plataforma'] = $plataforma;
    }

    if ($hay('category')) {
        $cols['categoria'] = gg_opcion($c, 'category', GG_PROD_CATEGORIAS, 'videojuegos');
    }

    if ($hay('genre')) {
        // Sin género es un valor válido y con significado: nadie ha clasificado
        // el título todavía. La tienda lo muestra sin etiqueta en vez de
        // colgarle un género inventado.
        $cols['genero'] = gg_opcion($c, 'genre', GG_PROD_GENEROS);
    }

    if ($hay('condition')) {
        $cols['estado_copia'] = gg_opcion($c, 'condition', GG_PROD_COPIAS, 'consultar');
    }

    if ($hay('region')) {
        $cols['region'] = gg_opcion($c, 'region', GG_PROD_REGIONES);
    }

    if ($hay('price')) {
        $cols['precio'] = gg_entero($c, 'price', 0, GG_PROD_PRECIO_MAX);
    }

    if ($hay('oldPrice')) {
        $cols['precio_antes'] = gg_entero($c, 'oldPrice', 0, GG_PROD_PRECIO_MAX);
    }

    if ($hay('stock')) {
        // null y 0 son cosas distintas: null es «disponibilidad por confirmar»
        // y 0 es «agotado». gg_entero ya conserva esa diferencia.
        $cols['stock'] = gg_entero($c, 'stock', 0, GG_PROD_STOCK_MAX);
    }

    if ($hay('sku')) {
        $sku = gg_texto($c, 'sku', 60);
        $cols['sku'] = $sku === '' ? null : $sku;
    }

    if ($hay('images')) {
        // Mismos parámetros de json_encode que usa la carga inicial del
        // catálogo, para que un producto sembrado y uno editado a mano guarden
        // la misma cadena y el historial no registre cambios que no existen.
        $cols['imagenes'] = json_encode(gg_prod_imagenes($c), JSON_UNESCAPED_SLASHES) ?: '[]';
    }

    if ($hay('imageSize')) {
        $tam = is_array($c['imageSize'] ?? null) ? $c['imageSize'] : [];
        $ancho = gg_entero($tam, 'w', 1, 20000);
        $alto  = gg_entero($tam, 'h', 1, 20000);
        // O las dos medidas o ninguna: con media medida no se puede reservar el
        // hueco de la imagen y la ficha daría el salto al cargar la portada.
        $completo = $ancho !== null && $alto !== null;
        $cols['imagen_w'] = $completo ? $ancho : null;
        $cols['imagen_h'] = $completo ? $alto : null;
    }

    if ($hay('description')) {
        $cols['descripcion'] = gg_texto($c, 'description', 4000);
    }

    if ($hay('note')) {
        $nota = gg_texto($c, 'note', 400);
        $cols['nota'] = $nota === '' ? null : $nota;
    }

    if ($hay('tags')) {
        $cols['etiquetas'] = json_encode(gg_lista($c, 'tags', 30, 60), JSON_UNESCAPED_UNICODE) ?: '[]';
    }

    // Los booleanos viajan como true/false y se guardan como 0/1.
    if ($hay('featured')) {
        $cols['destacado'] = gg_bool_entrada($c, 'featured') ? 1 : 0;
    }
    if ($hay('onSale')) {
        $cols['oferta'] = gg_bool_entrada($c, 'onSale') ? 1 : 0;
    }
    if ($hay('newRelease')) {
        $cols['lanzamiento'] = gg_bool_entrada($c, 'newRelease') ? 1 : 0;
    }
    if ($hay('bestSeller')) {
        $cols['mas_vendido'] = gg_bool_entrada($c, 'bestSeller') ? 1 : 0;
    }

    if ($hay('status')) {
        $cols['estado'] = gg_opcion($c, 'status', GG_PROD_ESTADOS, 'publicado');
    }

    return $cols;
}

/** Entero de una columna que admite null, tal y como lo devuelve SQLite. */
function gg_prod_num($v): ?int
{
    return $v === null ? null : (int) $v;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rutas
// ─────────────────────────────────────────────────────────────────────────────

$segundo = $ruta[1] ?? '';   // id, slug, o la palabra «destacados»
$accion  = $ruta[2] ?? '';   // duplicar | vista | stock
$metodo  = gg_metodo();
$cuerpo  = in_array($metodo, ['POST', 'PATCH', 'PUT'], true) ? gg_cuerpo() : [];

// ── POST /api/productos/{slug}/vista — SIN sesión ────────────────────────────
//
// Va la primera a propósito: es la única ruta de este archivo que no exige
// sesión, y así queda claro de un vistazo que ninguna comprobación de rol se
// saltó por accidente más abajo.
if ($segundo !== '' && $accion === 'vista' && $metodo === 'POST') {
    // La única escritura que puede hacer un visitante anónimo, y solo suma uno
    // a un contador: no crea nada, no borra nada y no devuelve ningún dato.
    gg_ejecutar(
        'UPDATE productos SET vistas = vistas + 1 WHERE slug = ?',
        [mb_substr($segundo, 0, 160)]
    );

    // Se responde lo mismo exista o no el slug. Un 404 aquí convertiría el
    // contador en una forma de averiguar qué borradores hay guardados.
    // Tampoco se audita: son visitas de tienda, llenarían el historial de ruido
    // y esconderían justo los cambios que hay que poder revisar.
    gg_responder(['ok' => true]);
}

// ── GET /api/productos — listado ─────────────────────────────────────────────
if ($segundo === '' && $metodo === 'GET') {
    // Cualquier rol puede mirar el catálogo; escribirlo ya es otra cosa.
    gg_exigir_sesion();

    $todos = filter_var($_GET['todos'] ?? '', FILTER_VALIDATE_BOOLEAN);

    // Dos consultas literales en vez de una con el filtro pegado: así el WHERE
    // nunca se construye con texto que venga de fuera.
    $filas = $todos
        ? gg_filas('SELECT * FROM productos ORDER BY orden ASC, nombre ASC')
        : gg_filas("SELECT * FROM productos WHERE estado = 'publicado' ORDER BY orden ASC, nombre ASC");

    // Sin registros se devuelve la lista vacía. La interfaz ya sabe pintar el
    // «todavía no hay productos»; inventar ejemplos sería peor.
    gg_responder(['productos' => array_map('gg_salida_producto', $filas)]);
}

// ── POST /api/productos — crear ──────────────────────────────────────────────
if ($segundo === '' && $metodo === 'POST') {
    gg_exigir_rol('editor');

    $cols = gg_prod_columnas($cuerpo, false);
    gg_prod_validar_precios($cols['precio'], $cols['precio_antes']);

    // Si no mandaron slug se saca del nombre. En ambos casos pasa por gg_slug.
    $base = gg_texto($cuerpo, 'slug', 160);
    $cols['slug'] = gg_prod_slug_unico($base !== '' ? $base : $cols['nombre']);

    $id = gg_id();
    $ahora = gg_ahora();

    // «vistas» y «orden» se quedan con el valor por omisión de la columna: no
    // son campos del formulario y no hay que inventarles nada.
    gg_insertar('productos', array_merge(
        ['id' => $id],
        $cols,
        ['creado' => $ahora, 'actualizado' => $ahora]
    ));

    gg_auditar('crear', 'productos', $id, $cols['nombre'], ['slug' => $cols['slug']]);

    // Se relee la fila recién insertada en vez de componer la respuesta a mano:
    // así lo que ve el panel es exactamente lo que quedó guardado, incluidos
    // los valores por omisión que puso la propia base.
    gg_responder(['producto' => gg_salida_producto(gg_prod_exigir($id))], 201);
}

// ── POST /api/productos/destacados — fijar los destacados de la portada ──────
if ($segundo === 'destacados' && $accion === '' && $metodo === 'POST') {
    gg_exigir_rol('editor');

    $ids = gg_lista($cuerpo, 'ids', 60, 60);
    $ahora = gg_ahora();
    $db = gg_db();

    // Las dos actualizaciones van juntas o no va ninguna: entre apagar todos
    // los destacados y encender los nuevos hay un instante en el que la portada
    // se queda sin ninguno, y si el segundo paso fallara se quedaría así.
    $db->beginTransaction();
    try {
        gg_ejecutar('UPDATE productos SET destacado = 0, actualizado = ? WHERE destacado = 1', [$ahora]);

        if ($ids) {
            // Los huecos «?» se generan a partir de la CANTIDAD de ids, nunca de
            // su contenido: los valores siguen viajando como parámetros.
            $huecos = implode(', ', array_fill(0, count($ids), '?'));
            gg_ejecutar(
                'UPDATE productos SET destacado = 1, actualizado = ? WHERE id IN (' . $huecos . ')',
                array_merge([$ahora], $ids)
            );
        }

        $db->commit();
    } catch (Throwable $e) {
        $db->rollBack();
        throw $e;
    }

    gg_auditar('actualizar', 'productos', null, 'Destacados de la portada', ['ids' => $ids]);
    gg_responder(['ok' => true]);
}

// ── POST /api/productos/{id}/duplicar ────────────────────────────────────────
if ($segundo !== '' && $accion === 'duplicar' && $metodo === 'POST') {
    gg_exigir_rol('editor');
    $original = gg_prod_exigir($segundo);

    $id = gg_id();
    $ahora = gg_ahora();

    // Se parte de la fila entera (SELECT *), que son exactamente las columnas
    // de la tabla, y se sustituye lo que no debe copiarse.
    $copia = $original;
    unset($copia['id'], $copia['vistas'], $copia['creado'], $copia['actualizado']);

    $copia['id'] = $id;
    $copia['slug'] = gg_prod_slug_unico($original['slug'] . '-copia');
    $copia['nombre'] = mb_substr((string) $original['nombre'], 0, 190) . ' (copia)';
    // Nace en borrador: una copia se duplica para retocarla, y publicarla sola
    // dejaría dos fichas casi iguales en la tienda.
    $copia['estado'] = 'borrador';
    // Y sin destacar: dos destacados idénticos en la portada no ayudan a nadie.
    $copia['destacado'] = 0;
    $copia['creado'] = $ahora;
    $copia['actualizado'] = $ahora;
    // «vistas» se omite para que arranque en 0: las visitas eran del original.

    gg_insertar('productos', $copia);
    gg_auditar('crear', 'productos', $id, $copia['nombre'], ['duplicadoDe' => $original['id']]);

    gg_responder(['producto' => gg_salida_producto(gg_prod_exigir($id))], 201);
}

// ── PATCH /api/productos/{id}/stock — atajo de la pantalla de inventario ─────
if ($segundo !== '' && $accion === 'stock' && $metodo === 'PATCH') {
    gg_exigir_rol('editor');
    $antes = gg_prod_exigir($segundo);

    // Se exige que la clave venga: si faltara, gg_entero devolvería null y esta
    // pantalla dejaría el producto en «disponibilidad por confirmar» sin que
    // nadie lo hubiera pedido.
    if (!array_key_exists('stock', $cuerpo)) {
        throw new GgError('Falta el campo «stock».');
    }
    $stock = gg_entero($cuerpo, 'stock', 0, GG_PROD_STOCK_MAX);

    gg_actualizar('productos', $antes['id'], ['stock' => $stock, 'actualizado' => gg_ahora()]);
    gg_auditar_cambio('productos', $antes['id'], (string) $antes['nombre'], $antes, ['stock' => $stock]);

    gg_responder(['producto' => gg_salida_producto(gg_prod_exigir($antes['id']))]);
}

// ── GET /api/productos/{id} — ficha ──────────────────────────────────────────
if ($segundo !== '' && $accion === '' && $metodo === 'GET') {
    gg_exigir_sesion();
    gg_responder(['producto' => gg_salida_producto(gg_prod_exigir($segundo))]);
}

// ── PATCH /api/productos/{id} — edición parcial ──────────────────────────────
if ($segundo !== '' && $accion === '' && $metodo === 'PATCH') {
    gg_exigir_rol('editor');
    $antes = gg_prod_exigir($segundo);

    $cols = gg_prod_columnas($cuerpo, true);

    // El slug solo se recalcula si lo mandaron: renombrar un juego no debe
    // romper por su cuenta el enlace que alguien ya compartió por WhatsApp.
    if (array_key_exists('slug', $cuerpo)) {
        $base = gg_texto($cuerpo, 'slug', 160);
        if ($base === '') {
            $base = (string) ($cols['nombre'] ?? $antes['nombre']);
        }
        $cols['slug'] = gg_prod_slug_unico($base, $antes['id']);
    }

    // La coherencia de precios se comprueba sobre el resultado final, no sobre
    // lo que llegó: en una edición parcial puede venir solo uno de los dos y el
    // otro seguir siendo el que ya estaba guardado.
    gg_prod_validar_precios(
        gg_prod_num(array_key_exists('precio', $cols) ? $cols['precio'] : $antes['precio']),
        gg_prod_num(array_key_exists('precio_antes', $cols) ? $cols['precio_antes'] : $antes['precio_antes'])
    );

    if (!$cols) {
        // No mandaron ningún campo conocido. Se devuelve el producto tal cual
        // en vez de tocar «actualizado» y dejar un cambio fantasma.
        gg_responder(['producto' => gg_salida_producto($antes)]);
    }

    $cols['actualizado'] = gg_ahora();
    gg_actualizar('productos', $antes['id'], $cols);

    // Solo se registra lo que cambió de verdad, con su valor anterior: un
    // «se actualizó el producto» a secas no sirve de nada cuando hay que
    // revisar un precio raro tres semanas después.
    gg_auditar_cambio(
        'productos',
        $antes['id'],
        (string) ($cols['nombre'] ?? $antes['nombre']),
        $antes,
        $cols
    );

    gg_responder(['producto' => gg_salida_producto(gg_prod_exigir($antes['id']))]);
}

// ── DELETE /api/productos/{id} ───────────────────────────────────────────────
if ($segundo !== '' && $accion === '' && $metodo === 'DELETE') {
    // Borrar es de administrador: un editor puede archivar el producto, que
    // deja de verse en la tienda y se puede deshacer.
    gg_exigir_rol('admin');
    $fila = gg_prod_exigir($segundo);

    gg_ejecutar('DELETE FROM productos WHERE id = ?', [$fila['id']]);

    // Los pedidos no se ven afectados: sus líneas guardan copia del nombre, la
    // plataforma y el precio del momento de la venta, precisamente para que el
    // histórico no cambie cuando el catálogo cambia.
    gg_auditar('eliminar', 'productos', $fila['id'], (string) $fila['nombre'], [
        'slug'       => $fila['slug'],
        'plataforma' => $fila['plataforma'],
    ]);

    gg_responder(['ok' => true]);
}

gg_error('No existe esa dirección en la API.', 404);

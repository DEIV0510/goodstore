<?php
declare(strict_types=1);

/**
 * /api/pedidos/...
 *
 * Las ventas se cierran por WhatsApp y las registra un administrador cuando la
 * conversación termina en compra. Por eso aquí no hay ninguna dirección
 * pública: cada pedido lleva pegados el nombre y el teléfono de una persona
 * real, así que ni siquiera leer la lista está al alcance de un editor.
 *
 * Las cifras de dinero NUNCA se aceptan del navegador. El subtotal y el total
 * los suma el servidor a partir de las líneas: aceptar el total que manda la
 * pantalla sería como dejar que el cliente ponga el precio.
 */

// Puerta única del archivo, antes de mirar siquiera qué se está pidiendo. Se
// comprueba en el servidor porque esconder el menú en el panel no protege
// nada: cualquiera puede lanzar la petición a mano.
//
// Va la PRIMERA, delante de leer el cuerpo: quien no ha iniciado sesión debe
// recibir un 401 sin que el servidor haya analizado su JSON. Al revés, un
// cuerpo mal formado contestaría 400 antes de comprobar el permiso, y ese 400
// ya le confirma a un desconocido que la dirección existe.
gg_exigir_rol('admin');

$metodo = gg_metodo();
$id     = $ruta[1] ?? '';
$cuerpo = in_array($metodo, ['POST', 'PATCH', 'PUT'], true) ? gg_cuerpo() : [];

// ─────────────────────────────────────────────────────────────────────────────
// Ayudas locales
// ─────────────────────────────────────────────────────────────────────────────

/** Estados que puede tener un pedido. Cualquier otro valor se rechaza. */
function gg_pedido_estados(): array
{
    return ['pendiente', 'confirmado', 'preparando', 'enviado', 'entregado', 'cancelado'];
}

/** Plataformas válidas para la copia que se guarda en la línea. */
function gg_pedido_plataformas(): array
{
    return ['ps5', 'ps4', 'switch', 'switch2', 'xbox'];
}

/**
 * Tope de dinero por campo (100 millones de pesos).
 *
 * No es un límite de negocio, es un cortafuegos: sin él, un número absurdo
 * enviado a mano desbordaría los enteros al sumar el total.
 */
function gg_pedido_max_dinero(): int
{
    return 100000000;
}

/** Máximo de líneas por pedido. Más que eso solo puede ser un error o una prueba. */
function gg_pedido_max_lineas(): int
{
    return 100;
}

/**
 * Texto opcional: vacío se guarda como NULL, no como cadena vacía.
 * Así "el administrador borró la nota" y "la nota nunca existió" son la misma
 * cosa en la base, y la interfaz recibe null tal como espera su modelo.
 */
function gg_pedido_texto_o_null(array $datos, string $clave, int $maximo): ?string
{
    $v = gg_texto($datos, $clave, $maximo);
    return $v === '' ? null : $v;
}

/**
 * Todas las líneas de varios pedidos, en UNA consulta, agrupadas por pedido.
 *
 * Pedir las líneas dentro del bucle de pedidos costaría una consulta por
 * pedido: con 200 pedidos son 200 viajes a la base solo para pintar una tabla.
 *
 * Los huecos «?» se generan a partir del NÚMERO de identificadores y los
 * identificadores viajan como parámetros: en la cadena SQL no entra ni un solo
 * valor venido del usuario.
 *
 * Se pide por tandas porque SQLite limita los parámetros de una consulta (999
 * en compilaciones antiguas). Hoy la tienda no llega, pero el día que llegue no
 * debe fallar de golpe.
 */
function gg_pedidos_lineas_agrupadas(array $pedidoIds): array
{
    $grupos = [];
    foreach (array_chunk($pedidoIds, 300) as $tanda) {
        $huecos = implode(', ', array_fill(0, count($tanda), '?'));
        // rowid conserva el orden en que se guardaron las líneas, que es el
        // orden en que el administrador las escribió en el pedido.
        $filas = gg_filas(
            'SELECT * FROM pedido_lineas WHERE pedido_id IN (' . $huecos . ') ORDER BY rowid ASC',
            $tanda
        );
        foreach ($filas as $f) {
            $grupos[$f['pedido_id']][] = $f;
        }
    }
    return $grupos;
}

/** Los clientes de varios pedidos, en una consulta, indexados por id. */
function gg_pedidos_clientes_por_id(array $clienteIds): array
{
    $mapa = [];
    foreach (array_chunk($clienteIds, 300) as $tanda) {
        $huecos = implode(', ', array_fill(0, count($tanda), '?'));
        foreach (gg_filas('SELECT * FROM clientes WHERE id IN (' . $huecos . ')', $tanda) as $f) {
            $mapa[$f['id']] = $f;
        }
    }
    return $mapa;
}

/**
 * De una lista de identificadores de producto, los que todavía existen.
 *
 * Se preguntan todos de una vez. Preguntar producto por producto dentro del
 * bucle de líneas costaba una consulta por línea: registrar un pedido de 40
 * juegos eran 40 viajes a la base solo para comprobar referencias.
 *
 * Como en las demás, los huecos «?» salen del NÚMERO de identificadores y los
 * identificadores viajan como parámetros: en la cadena SQL no entra ni un solo
 * valor venido del usuario.
 */
function gg_pedidos_productos_existentes(array $ids): array
{
    $vivos = [];
    foreach (array_chunk(array_values(array_unique($ids)), 300) as $tanda) {
        $huecos = implode(', ', array_fill(0, count($tanda), '?'));
        foreach (gg_filas('SELECT id FROM productos WHERE id IN (' . $huecos . ')', $tanda) as $f) {
            $vivos[$f['id']] = true;
        }
    }
    return $vivos;
}

/** Un pedido completo (líneas y cliente) con la forma que espera la interfaz. */
function gg_pedido_uno(string $id): ?array
{
    $p = gg_fila('SELECT * FROM pedidos WHERE id = ?', [$id]);
    if (!$p) {
        return null;
    }
    $lineas = gg_filas('SELECT * FROM pedido_lineas WHERE pedido_id = ? ORDER BY rowid ASC', [$id]);
    $cliente = $p['cliente_id'] !== null
        ? gg_fila('SELECT * FROM clientes WHERE id = ?', [$p['cliente_id']])
        : null;

    return gg_salida_pedido($p, $lineas, $cliente);
}

/**
 * Código legible y ordenable: GG-AAMMDD-NNNN.
 *
 * Lleva la fecha delante para que ordenar por código sea ordenar por día, y
 * cuatro cifras al azar en vez de un contador para no tener que mantener una
 * secuencia aparte. Si el número ya estuviera usado se reintenta: la columna es
 * UNIQUE y un choque tumbaría la inserción entera.
 */
function gg_pedido_codigo_nuevo(): string
{
    $dia = gmdate('ymd');

    for ($intento = 0; $intento < 25; $intento++) {
        $codigo = 'GG-' . $dia . '-' . random_int(1000, 9999);
        if (gg_valor('SELECT 1 FROM pedidos WHERE codigo = ?', [$codigo]) === null) {
            return $codigo;
        }
    }

    // Reserva por si el día estuviera casi lleno y el azar siguiera chocando:
    // se continúa por el número más alto ya usado. Vale más un código feo que
    // dejar al administrador sin poder registrar la venta que acaba de cerrar.
    // El número empieza en el carácter 11: «GG-» (3) + AAMMDD (6) + «-» (1).
    $ultimo = (int) gg_valor(
        'SELECT MAX(CAST(substr(codigo, 11) AS INTEGER)) FROM pedidos WHERE codigo LIKE ?',
        ['GG-' . $dia . '-%']
    );
    for ($n = max(1000, $ultimo + 1); $n <= 9999; $n++) {
        $codigo = 'GG-' . $dia . '-' . str_pad((string) $n, 4, '0', STR_PAD_LEFT);
        if (gg_valor('SELECT 1 FROM pedidos WHERE codigo = ?', [$codigo]) === null) {
            return $codigo;
        }
    }

    throw new GgError('Hoy ya no quedan códigos de pedido libres. Avisa al desarrollador.', 409);
}

/**
 * Valida las líneas que llegan del navegador y devuelve las filas a guardar.
 *
 * Se guarda COPIA del nombre, la plataforma, la imagen y el precio del momento
 * de la venta. Si mañana el producto cambia de precio o se borra del catálogo,
 * el pedido histórico tiene que seguir contando lo que se vendió aquel día.
 */
function gg_pedido_lineas_validadas(array $cuerpo, string $pedidoId): array
{
    $entrada = $cuerpo['items'] ?? null;
    if (!is_array($entrada) || !$entrada) {
        throw new GgError('El pedido necesita al menos una línea.');
    }
    if (count($entrada) > gg_pedido_max_lineas()) {
        throw new GgError('Un pedido no puede tener más de ' . gg_pedido_max_lineas() . ' líneas.');
    }

    $lineas = [];
    foreach ($entrada as $item) {
        if (!is_array($item)) {
            throw new GgError('Cada línea del pedido debe ser un objeto con sus datos.');
        }

        $lineas[] = [
            'id'          => gg_id(),
            'pedido_id'   => $pedidoId,
            // El producto puede haber desaparecido del catálogo o ser algo
            // suelto que no está en él: por eso la referencia es opcional y la
            // columna no tiene clave foránea. El nombre, en cambio, es
            // obligatorio. Las referencias se comprueban al salir del bucle,
            // todas en una sola consulta.
            'producto_id' => gg_pedido_texto_o_null($item, 'productId', 60),
            'nombre'      => gg_texto_obligatorio($item, 'name', 200),
            'plataforma'  => gg_opcion($item, 'platform', gg_pedido_plataformas()),
            // gg_enlace deja pasar solo rutas del sitio y http(s): así una
            // imagen guardada aquí no puede acabar siendo un «javascript:».
            'imagen'      => gg_enlace($item, 'image', '') ?: null,
            'precio_unit' => gg_entero($item, 'unitPrice', 0, gg_pedido_max_dinero()) ?? 0,
            'cantidad'    => gg_entero($item, 'qty', 1, 999) ?? 1,
        ];
    }

    // Las referencias que ya no apuntan a ningún producto se olvidan, pero la
    // línea se conserva entera: un pedido no se pierde porque alguien borrara
    // el juego del catálogo.
    $referencias = array_values(array_filter(
        array_column($lineas, 'producto_id'),
        static fn($v) => $v !== null
    ));
    if ($referencias) {
        $vivos = gg_pedidos_productos_existentes($referencias);
        foreach ($lineas as $i => $l) {
            if ($l['producto_id'] !== null && !isset($vivos[$l['producto_id']])) {
                $lineas[$i]['producto_id'] = null;
            }
        }
    }

    return $lineas;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/pedidos — lista completa, del más nuevo al más viejo
// ─────────────────────────────────────────────────────────────────────────────
if ($id === '' && $metodo === 'GET') {
    // El código desempata a los pedidos creados en el mismo segundo; sin eso el
    // orden entre ellos sería el que quisiera la base, y cambiaría entre
    // recargas de la misma pantalla.
    $pedidos = gg_filas('SELECT * FROM pedidos ORDER BY creado DESC, codigo DESC');

    // Sin pedidos se devuelve una lista vacía. Nada de ejemplos inventados: el
    // panel calcula ventas y totales con esto, y un pedido de mentira falsearía
    // las cifras del negocio.
    if (!$pedidos) {
        gg_responder(['pedidos' => []]);
    }

    $lineasPorPedido = gg_pedidos_lineas_agrupadas(array_column($pedidos, 'id'));

    $clienteIds = array_values(array_unique(array_filter(
        array_column($pedidos, 'cliente_id'),
        static fn($v) => $v !== null && $v !== ''
    )));
    $clientes = $clienteIds ? gg_pedidos_clientes_por_id($clienteIds) : [];

    $salida = [];
    foreach ($pedidos as $p) {
        $cliente = ($p['cliente_id'] !== null && isset($clientes[$p['cliente_id']]))
            ? $clientes[$p['cliente_id']]
            : null;
        $salida[] = gg_salida_pedido($p, $lineasPorPedido[$p['id']] ?? [], $cliente);
    }

    gg_responder(['pedidos' => $salida]);
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/pedidos — registrar una venta
// ─────────────────────────────────────────────────────────────────────────────
if ($id === '' && $metodo === 'POST') {
    $clienteId = gg_pedido_texto_o_null($cuerpo, 'customerId', 60);
    if ($clienteId !== null && gg_valor('SELECT 1 FROM clientes WHERE id = ?', [$clienteId]) === null) {
        // Se avisa en claro en vez de dejar que reviente la clave foránea con
        // un error de base de datos que no le dice nada a nadie.
        throw new GgError('El cliente indicado ya no existe. Vuelve a elegirlo.');
    }

    $estado = gg_opcion($cuerpo, 'status', gg_pedido_estados(), 'pendiente');
    // La columna es NOT NULL: un canal vacío vuelve al de siempre, que es por
    // donde entra hoy el 100 % de las ventas.
    $canal  = gg_pedido_texto_o_null($cuerpo, 'channel', 40) ?? 'whatsapp';
    $pago   = gg_pedido_texto_o_null($cuerpo, 'paymentMethod', 60);
    $notas  = gg_pedido_texto_o_null($cuerpo, 'notes', 2000);
    $envio  = gg_entero($cuerpo, 'shipping', 0, gg_pedido_max_dinero()) ?? 0;

    $pedidoId = gg_id();
    $lineas   = gg_pedido_lineas_validadas($cuerpo, $pedidoId);

    // Las cifras se calculan aquí, con los precios ya validados. Lo que venga
    // en «subtotal» o «total» dentro del cuerpo se ignora a propósito.
    $subtotal = 0;
    foreach ($lineas as $l) {
        $subtotal += $l['precio_unit'] * $l['cantidad'];
    }
    $total = $subtotal + $envio;

    $ahora = gg_ahora();
    $db = gg_db();
    $codigo = '';

    // Un pedido sin líneas no sirve de nada: o se guarda entero o no se guarda.
    // El reintento cubre el hueco entre comprobar el código y usarlo: si dos
    // administradores registran a la vez, UNIQUE tiene la última palabra.
    for ($intento = 1; ; $intento++) {
        $codigo = gg_pedido_codigo_nuevo();
        $db->beginTransaction();
        try {
            gg_insertar('pedidos', [
                'id'          => $pedidoId,
                'codigo'      => $codigo,
                'cliente_id'  => $clienteId,
                'estado'      => $estado,
                'pago'        => $pago,
                'canal'       => $canal,
                'subtotal'    => $subtotal,
                'envio'       => $envio,
                'total'       => $total,
                'notas'       => $notas,
                'creado'      => $ahora,
                'actualizado' => $ahora,
            ]);
            foreach ($lineas as $l) {
                gg_insertar('pedido_lineas', $l);
            }
            $db->commit();
            break;
        } catch (PDOException $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            if ($intento >= 3 || !str_contains($e->getMessage(), 'UNIQUE')) {
                throw $e;
            }
        } catch (Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            throw $e;
        }
    }

    gg_auditar('crear', 'pedidos', $pedidoId, $codigo, [
        'total'  => $total,
        'lineas' => count($lineas),
    ]);

    gg_responder(['pedido' => gg_pedido_uno($pedidoId)], 201);
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/pedidos/{id}
// ─────────────────────────────────────────────────────────────────────────────
if ($id !== '' && count($ruta) === 2 && $metodo === 'GET') {
    $pedido = gg_pedido_uno($id);
    if (!$pedido) {
        throw new GgError('Ese pedido no existe o ya se eliminó.', 404);
    }
    gg_responder(['pedido' => $pedido]);
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/pedidos/{id} — cambios parciales
// ─────────────────────────────────────────────────────────────────────────────
if ($id !== '' && count($ruta) === 2 && $metodo === 'PATCH') {
    $antes = gg_fila('SELECT * FROM pedidos WHERE id = ?', [$id]);
    if (!$antes) {
        throw new GgError('Ese pedido no existe o ya se eliminó.', 404);
    }

    // Solo se tocan las columnas que vienen en el cuerpo. Se mira con
    // array_key_exists y no con isset porque null es un valor legítimo aquí:
    // significa "borra este dato", que no es lo mismo que "no lo cambies".
    $cambios = [];

    if (array_key_exists('status', $cuerpo)) {
        $estado = gg_opcion($cuerpo, 'status', gg_pedido_estados());
        if ($estado === null) {
            throw new GgError('El estado del pedido no es válido.');
        }
        $cambios['estado'] = $estado;
    }

    if (array_key_exists('paymentMethod', $cuerpo)) {
        $cambios['pago'] = gg_pedido_texto_o_null($cuerpo, 'paymentMethod', 60);
    }

    if (array_key_exists('notes', $cuerpo)) {
        $cambios['notas'] = gg_pedido_texto_o_null($cuerpo, 'notes', 2000);
    }

    if (array_key_exists('shipping', $cuerpo)) {
        $envio = gg_entero($cuerpo, 'shipping', 0, gg_pedido_max_dinero()) ?? 0;
        $cambios['envio'] = $envio;
        // El total se recalcula con el subtotal que ya está guardado, nunca con
        // uno que mande el navegador. Si no se recalculara, el pedido quedaría
        // con un total que no cuadra con sus propias cifras.
        $cambios['total'] = (int) $antes['subtotal'] + $envio;
    }

    // El catálogo de líneas no se edita desde aquí a propósito: cambiar las
    // líneas cambia el subtotal, y eso es rehacer el pedido, no retocarlo.
    if ($cambios) {
        $cambios['actualizado'] = gg_ahora();
        gg_actualizar('pedidos', $id, $cambios);
        gg_auditar_cambio('pedidos', $id, (string) $antes['codigo'], $antes, $cambios);
    }

    gg_responder(['pedido' => gg_pedido_uno($id)]);
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/pedidos/{id}
// ─────────────────────────────────────────────────────────────────────────────
if ($id !== '' && count($ruta) === 2 && $metodo === 'DELETE') {
    $pedido = gg_fila('SELECT * FROM pedidos WHERE id = ?', [$id]);
    if (!$pedido) {
        throw new GgError('Ese pedido no existe o ya se eliminó.', 404);
    }

    // Las líneas se van solas: pedido_lineas declara ON DELETE CASCADE y la
    // conexión arranca con PRAGMA foreign_keys = ON. Sin ese pragma, SQLite
    // ignoraría la cascada y dejaría líneas huérfanas.
    gg_ejecutar('DELETE FROM pedidos WHERE id = ?', [$id]);

    // Queda constancia de qué se borró: una vez eliminado, el historial es lo
    // único que puede explicar por qué las ventas del mes bajaron.
    gg_auditar('eliminar', 'pedidos', $id, (string) $pedido['codigo'], [
        'total'  => (int) $pedido['total'],
        'estado' => $pedido['estado'],
    ]);

    gg_responder(['ok' => true]);
}

gg_error('No existe esa dirección en la API.', 404);

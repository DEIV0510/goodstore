<?php
declare(strict_types=1);

/**
 * /api/pago · Checkout Web de Wompi
 *
 * Dos direcciones, las dos públicas, porque las usa un comprador que todavía no
 * tiene sesión de nada:
 *
 *   POST /api/pago/preparar   carrito → pedido pendiente + formulario firmado
 *   GET  /api/pago/estado     vuelta de la pasarela → estado real del pago
 *
 * ── Lo que de verdad protege esto ────────────────────────────────────────────
 *
 * El navegador manda QUÉ quiere comprar (slug y cantidad), nunca CUÁNTO cuesta.
 * El total se calcula aquí, leyendo los precios de la base, y es ese total el
 * que se firma. Si alguien edita la petición para pagar mil pesos por una
 * consola, lo que llega es la lista de productos: el precio lo sigue poniendo
 * el servidor.
 *
 * El secreto de integridad vive en el grupo «secretos» de la tabla de opciones,
 * que ninguna ruta de lectura devuelve. Nunca sale de este archivo: ni al panel,
 * ni a la tienda, ni al historial.
 */

$metodo = gg_metodo();
$accion = $ruta[1] ?? '';

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

/** Direcciones oficiales de Wompi. Producción o pruebas según la llave. */
const GG_WOMPI_CHECKOUT = 'https://checkout.wompi.co/p/';
const GG_WOMPI_API_PROD = 'https://production.wompi.co/v1';
const GG_WOMPI_API_TEST = 'https://sandbox.wompi.co/v1';

/** Tope de seguridad: un carrito con más líneas no es un carrito, es un ataque. */
const GG_PAGO_MAX_LINEAS = 60;

/** Y una cantidad por línea que un negocio de barrio no va a despachar jamás. */
const GG_PAGO_MAX_CANTIDAD = 20;

// ─────────────────────────────────────────────────────────────────────────────
// Ayudas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuración de la pasarela: lo público de «ajustes» más el secreto, que
 * vive aparte para que no pueda salir por una ruta de lectura.
 */
function gg_pago_config(): array
{
    $p = gg_opciones('ajustes')['payments'] ?? [];
    $secretos = gg_opciones('secretos');

    return [
        'activo'    => gg_bool($p['enabled'] ?? false),
        'modo'      => ($p['mode'] ?? 'enlace') === 'checkout' ? 'checkout' : 'enlace',
        'llave'     => trim((string) ($p['publicKey'] ?? '')),
        'integridad'=> trim((string) ($secretos['wompiIntegridad'] ?? '')),
        'proveedor' => trim((string) ($p['provider'] ?? '')) ?: 'Wompi',
    ];
}

/** Las llaves de prueba de Wompi empiezan por pub_test_; el resto es producción. */
function gg_pago_api(string $llave): string
{
    return str_starts_with($llave, 'pub_test_') ? GG_WOMPI_API_TEST : GG_WOMPI_API_PROD;
}

/**
 * Firma de integridad de Wompi.
 *
 *   SHA256(referencia + importeEnCentavos + moneda + secreto)
 *
 * El orden importa y no es negociable. Está verificada contra el ejemplo de la
 * documentación de Wompi (ver la prueba en tools/prueba-firma-wompi.php), que es
 * la única forma de saber que esto está bien sin cobrarle a nadie de verdad.
 */
function gg_pago_firma(string $referencia, int $centavos, string $moneda, string $secreto): string
{
    return hash('sha256', $referencia . $centavos . $moneda . $secreto);
}

/**
 * Referencia única para la pasarela.
 *
 * Lleva el código del pedido delante para que el negocio lo reconozca de un
 * vistazo, y una cola aleatoria porque Wompi rechaza una referencia repetida:
 * si alguien vuelve a intentar el pago del mismo pedido, necesita una nueva.
 */
function gg_pago_referencia(string $codigoPedido): string
{
    return $codigoPedido . '-' . strtoupper(bin2hex(random_bytes(3)));
}

/**
 * Pide algo a la API de Wompi.
 *
 * Se intenta con cURL y, si el hosting no la trae, con el envoltorio de flujos.
 * En hosting compartido cualquiera de las dos puede estar apagada, así que el
 * mensaje distingue «no se pudo preguntar» de «la pasarela dijo que no»: no es
 * lo mismo para quien está esperando su pedido.
 */
function gg_pago_consultar(string $url, string $llave): array
{
    $cabeceras = ['Authorization: Bearer ' . $llave, 'Accept: application/json'];

    if (function_exists('curl_init')) {
        $c = curl_init($url);
        curl_setopt_array($c, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => $cabeceras,
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_CONNECTTIMEOUT => 8,
            // Verificación del certificado ACTIVADA. Desactivarla dejaría el
            // estado de un pago a merced de quien se cuele en el camino.
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);
        $cuerpo = curl_exec($c);
        $error = curl_error($c);
        curl_close($c);

        if ($cuerpo === false) {
            throw new GgError('No se pudo consultar el estado del pago: ' . $error, 502);
        }
        return gg_json((string) $cuerpo, []);
    }

    if (!ini_get('allow_url_fopen')) {
        throw new GgError(
            'Este servidor no puede consultar a la pasarela (ni cURL ni allow_url_fopen). ' .
            'El pago puede haberse hecho igualmente: compruébalo en el panel de Wompi.',
            502
        );
    }

    $ctx = stream_context_create(['http' => [
        'method'        => 'GET',
        'header'        => implode("\r\n", $cabeceras),
        'timeout'       => 15,
        'ignore_errors' => true,
    ]]);
    $cuerpo = @file_get_contents($url, false, $ctx);
    if ($cuerpo === false) {
        throw new GgError('No se pudo consultar el estado del pago.', 502);
    }
    return gg_json((string) $cuerpo, []);
}

/** Estados de Wompi traducidos a algo que se pueda enseñar en pantalla. */
function gg_pago_mensaje(string $estado): string
{
    return match ($estado) {
        'APPROVED' => 'Tu pago fue aprobado.',
        'PENDING'  => 'Tu pago está en proceso. En cuanto la entidad lo confirme, te avisamos.',
        'DECLINED' => 'La entidad rechazó el pago. No se te cobró nada.',
        'VOIDED'   => 'El pago fue anulado. No se te cobró nada.',
        'ERROR'    => 'La pasarela tuvo un problema con el pago. No se te cobró nada.',
        default    => 'No pudimos determinar el estado del pago.',
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/pago/preparar
// ─────────────────────────────────────────────────────────────────────────────

if ($accion === 'preparar' && $metodo === 'POST') {
    $cfg = gg_pago_config();

    if (!$cfg['activo'] || $cfg['modo'] !== 'checkout') {
        throw new GgError('El pago en línea no está disponible ahora mismo.', 409);
    }
    if ($cfg['llave'] === '' || $cfg['integridad'] === '') {
        // Le pasa al negocio, no al comprador, pero el comprador es quien lo ve:
        // por eso el mensaje no habla de llaves ni de configuración.
        throw new GgError(
            'El pago en línea todavía no está listo. Escríbenos por WhatsApp y lo cerramos por ahí.',
            409
        );
    }

    $cuerpo = gg_cuerpo();
    $items = $cuerpo['items'] ?? null;
    if (!is_array($items) || $items === []) {
        throw new GgError('El carrito llegó vacío.', 400);
    }
    if (count($items) > GG_PAGO_MAX_LINEAS) {
        throw new GgError('El carrito tiene demasiadas líneas.', 400);
    }

    // ── Se rearma el carrito con los datos de la base ────────────────────────
    // De la petición solo se acepta QUÉ y CUÁNTOS. El precio, el nombre y la
    // disponibilidad salen de aquí.
    $lineas = [];
    $subtotal = 0;

    foreach ($items as $item) {
        if (!is_array($item)) {
            throw new GgError('El carrito llegó mal formado.', 400);
        }
        // El slug se normaliza en vez de confiar en él: así lo que viaja a la
        // consulta tiene siempre la misma forma, venga como venga.
        $slug = gg_slug(gg_texto($item, 'slug', 140));
        if ($slug === '') {
            throw new GgError('El carrito llegó mal formado.', 400);
        }
        $cantidad = gg_entero($item, 'qty', 1, GG_PAGO_MAX_CANTIDAD) ?? 1;

        $p = gg_fila(
            "SELECT id, nombre, plataforma, precio, stock, imagenes
             FROM productos WHERE slug = ? AND estado = 'publicado'",
            [$slug]
        );
        if (!$p) {
            throw new GgError("Uno de los productos ya no está disponible ($slug).", 409);
        }
        if ($p['precio'] === null) {
            // Es la misma regla que aplica la tienda al esconder el botón. Aquí
            // se repite porque una regla que solo vive en la interfaz no es una
            // regla: es una sugerencia.
            throw new GgError(
                'Hay un producto sin precio publicado en tu carrito. Escríbenos por ' .
                'WhatsApp y te confirmamos el valor.',
                409
            );
        }
        if ($p['stock'] !== null && (int) $p['stock'] < $cantidad) {
            throw new GgError(
                'No nos queda suficiente stock de «' . $p['nombre'] . '». ' .
                'Ajusta la cantidad y vuelve a intentarlo.',
                409
            );
        }

        $imagenes = gg_json($p['imagenes'], []);
        $lineas[] = [
            'producto_id' => $p['id'],
            'nombre'      => $p['nombre'],
            'plataforma'  => $p['plataforma'],
            'imagen'      => is_array($imagenes) ? ($imagenes[0] ?? null) : null,
            'precio_unit' => (int) $p['precio'],
            'cantidad'    => $cantidad,
        ];
        $subtotal += ((int) $p['precio']) * $cantidad;
    }

    if ($subtotal <= 0) {
        throw new GgError('El total del carrito no es válido.', 400);
    }

    // ── Se guarda el pedido antes de mandar a nadie a pagar ──────────────────
    // Si el cliente paga y se le cierra el navegador, el pedido ya existe y la
    // referencia lo encuentra. Al revés no habría forma de saber qué compró.
    $ahora = gg_ahora();
    $pedidoId = gg_id();
    $codigo = gg_pedido_codigo_nuevo();
    $referencia = gg_pago_referencia($codigo);

    $db = gg_db();
    $db->beginTransaction();
    try {
        gg_insertar('pedidos', [
            'id'          => $pedidoId,
            'codigo'      => $codigo,
            'estado'      => 'pendiente',
            'pago'        => $cfg['proveedor'],
            'canal'       => 'web',
            'subtotal'    => $subtotal,
            'envio'       => 0,
            'total'       => $subtotal,
            'notas'       => 'Pedido creado por la tienda al iniciar un pago en línea.',
            'pago_ref'    => $referencia,
            'creado'      => $ahora,
            'actualizado' => $ahora,
        ]);
        foreach ($lineas as $l) {
            gg_insertar('pedido_lineas', ['id' => gg_id(), 'pedido_id' => $pedidoId] + $l);
        }
        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $e;
    }

    // Wompi trabaja en centavos. El catálogo está en pesos enteros.
    $centavos = $subtotal * 100;

    gg_responder([
        'url'    => GG_WOMPI_CHECKOUT,
        'pedido' => $codigo,
        'total'  => $subtotal,
        // Estos son los campos del formulario, tal cual. La firma se calculó
        // aquí: el navegador no ve el secreto ni puede rehacerla.
        'campos' => [
            'public-key'        => $cfg['llave'],
            'currency'          => 'COP',
            'amount-in-cents'   => (string) $centavos,
            'reference'         => $referencia,
            'signature:integrity' => gg_pago_firma($referencia, $centavos, 'COP', $cfg['integridad']),
            'redirect-url'      => gg_url_sitio() . '/pago',
        ],
    ], 201);
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/pago/estado?id=…
//
// La pasarela devuelve al cliente con el id de la transacción en la dirección.
// El estado NO se cree de lo que venga en la URL: se le pregunta a Wompi.
// ─────────────────────────────────────────────────────────────────────────────

if ($accion === 'estado' && $metodo === 'GET') {
    $cfg = gg_pago_config();
    if ($cfg['llave'] === '') {
        throw new GgError('El pago en línea no está configurado.', 409);
    }

    $id = gg_texto($_GET, 'id', 64);
    if ($id === '' || !preg_match('/^[A-Za-z0-9_-]+$/', $id)) {
        throw new GgError('Falta el identificador de la transacción.', 400);
    }

    $r = gg_pago_consultar(gg_pago_api($cfg['llave']) . '/transactions/' . $id, $cfg['llave']);
    $t = $r['data'] ?? null;
    if (!is_array($t)) {
        throw new GgError('La pasarela no reconoce esa transacción.', 404);
    }

    $estado = (string) ($t['status'] ?? '');
    $referencia = (string) ($t['reference'] ?? '');
    $centavos = (int) ($t['amount_in_cents'] ?? 0);

    // ── Se anota en el pedido ────────────────────────────────────────────────
    $pedido = $referencia !== ''
        ? gg_fila('SELECT * FROM pedidos WHERE pago_ref = ?', [$referencia])
        : null;

    if ($pedido) {
        // Se comprueba que el importe cobrado es el que se pidió. Si no cuadra,
        // el pedido NO se da por bueno: es preferible que alguien lo revise a
        // mano a despachar por un valor que no es.
        $cuadra = $centavos === ((int) $pedido['total']) * 100;
        $nuevoEstado = ($estado === 'APPROVED' && $cuadra) ? 'confirmado' : $pedido['estado'];

        // Solo se escribe si algo cambió: volver a cargar la página de retorno
        // no debe ensuciar el historial ni tocar la fecha del pedido.
        if ($nuevoEstado !== $pedido['estado'] || ($pedido['pago_id'] ?? '') !== $id) {
            gg_actualizar('pedidos', $pedido['id'], [
                'estado'      => $nuevoEstado,
                'pago_id'     => $id,
                'actualizado' => gg_ahora(),
            ]);
            gg_auditar(
                'actualizar',
                'pedidos',
                $pedido['id'],
                (string) $pedido['codigo'],
                ['pago' => ['antes' => $pedido['estado'], 'ahora' => $nuevoEstado . ' · ' . $estado]]
            );
        }

        if ($estado === 'APPROVED' && !$cuadra) {
            gg_responder([
                'estado'   => 'REVISAR',
                'mensaje'  => 'Recibimos un pago por un valor distinto al del pedido. ' .
                              'Escríbenos por WhatsApp y lo revisamos contigo.',
                'pedido'   => $pedido['codigo'],
                'total'    => (int) $pedido['total'],
                'pagado'   => intdiv($centavos, 100),
            ]);
        }
    }

    gg_responder([
        'estado'  => $estado,
        'mensaje' => gg_pago_mensaje($estado),
        'pedido'  => $pedido['codigo'] ?? null,
        'total'   => intdiv($centavos, 100),
    ]);
}

gg_error('No existe esa dirección en la API.', 404);

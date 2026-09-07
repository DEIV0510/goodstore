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

/**
 * Cómo cobra la tienda mientras nadie haya tocado Ajustes → Pagos.
 *
 * Tienen que ser LOS MISMOS valores que trae la tienda en
 * `src/services/ajustes.ts`. Si no, pasa exactamente lo que pasó al publicar:
 * el carrito enseñaba el botón de pagar —porque su valor por omisión decía que
 * sí— y el servidor respondía «no está disponible», porque el suyo decía que
 * no. Nadie podía comprar y no había ningún error a la vista.
 */
const GG_PAGO_ACTIVO_OMISION = true;
const GG_PAGO_MODO_OMISION = 'enlace';
const GG_PAGO_PROVEEDOR_OMISION = 'Nequi';
const GG_PAGO_ENLACE_OMISION = 'https://checkout.nequi.wompi.co/l/xT7STl';

// ─────────────────────────────────────────────────────────────────────────────
// Ayudas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuración de la pasarela: lo público de «ajustes» más el secreto, que
 * vive aparte para que no pueda salir por una ruta de lectura.
 *
 * Cuando la sección nunca se ha guardado se usan los valores por omisión, los
 * mismos que la tienda: así el sitio cobra desde el minuto uno sin que nadie
 * tenga que entrar al panel a confirmar lo que ya venía puesto.
 */
function gg_pago_config(): array
{
    $guardado = gg_opciones('ajustes');
    $p = is_array($guardado['payments'] ?? null) ? $guardado['payments'] : [];
    $secretos = gg_opciones('secretos');

    return [
        'activo'    => array_key_exists('enabled', $p)
            ? gg_bool($p['enabled'])
            : GG_PAGO_ACTIVO_OMISION,
        'modo'      => ($p['mode'] ?? GG_PAGO_MODO_OMISION) === 'checkout' ? 'checkout' : 'enlace',
        'enlace'    => trim((string) ($p['link'] ?? '')) ?: GG_PAGO_ENLACE_OMISION,
        'llave'     => trim((string) ($p['publicKey'] ?? '')),
        'integridad'=> trim((string) ($secretos['wompiIntegridad'] ?? '')),
        'proveedor' => trim((string) ($p['provider'] ?? '')) ?: GG_PAGO_PROVEEDOR_OMISION,
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

/**
 * Guarda (o actualiza) al cliente y devuelve su ficha.
 *
 * El WhatsApp es la clave: es el único dato que en Colombia identifica a una
 * persona de verdad en una tienda pequeña, y la tabla lo tiene como UNIQUE. Si
 * ya compró antes, se actualiza lo que haya cambiado en vez de crear un
 * duplicado — y NO se pisa con vacío lo que ya estaba.
 */
function gg_pago_cliente(array $datos): ?array
{
    $whatsapp = preg_replace('/\D/', '', gg_texto($datos, 'whatsapp', 30)) ?? '';
    // Los colombianos lo escriben de mil formas: +57, 57, con espacios…
    if (strlen($whatsapp) > 10 && str_starts_with($whatsapp, '57')) {
        $whatsapp = substr($whatsapp, 2);
    }
    if (strlen($whatsapp) !== 10) {
        throw new GgError('Escribe tu WhatsApp a 10 dígitos, para poder coordinar el envío.', 400);
    }

    $nombre = gg_texto($datos, 'nombre', 120);
    if ($nombre === '') {
        throw new GgError('Escribe tu nombre.', 400);
    }

    $email = gg_texto($datos, 'email', 160);
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new GgError('Ese correo no parece válido. Déjalo vacío si prefieres.', 400);
    }
    $ciudad = gg_texto($datos, 'ciudad', 80);
    $ahora = gg_ahora();

    $ficha = gg_fila('SELECT * FROM clientes WHERE whatsapp = ?', [$whatsapp]);

    if ($ficha) {
        gg_actualizar('clientes', $ficha['id'], [
            'nombre'      => $nombre,
            // Un campo vacío ahora no borra lo que el cliente dio otra vez.
            'email'       => $email !== '' ? $email : $ficha['email'],
            'ciudad'      => $ciudad !== '' ? $ciudad : $ficha['ciudad'],
            'actualizado' => $ahora,
        ]);
        return gg_fila('SELECT * FROM clientes WHERE id = ?', [$ficha['id']]);
    }

    $id = gg_id();
    gg_insertar('clientes', [
        'id'          => $id,
        'nombre'      => $nombre,
        'whatsapp'    => $whatsapp,
        'email'       => $email !== '' ? $email : null,
        'ciudad'      => $ciudad !== '' ? $ciudad : null,
        'creado'      => $ahora,
        'actualizado' => $ahora,
    ]);
    return gg_fila('SELECT * FROM clientes WHERE id = ?', [$id]);
}

/**
 * Manda los avisos y anota que ya se mandaron.
 *
 * Se traga cualquier fallo: el pedido ya está guardado y, si es el caso, el
 * dinero ya se cobró. Que el correo no salga es un problema, pero no es motivo
 * para devolverle un error a quien acaba de comprar.
 */
function gg_pago_avisar(array $pedido, array $lineas, ?array $cliente, string $evento): void
{
    try {
        gg_correo_al_negocio($pedido, $lineas, $cliente, $evento);
        gg_correo_al_cliente($pedido, $lineas, $cliente, $evento);
        gg_actualizar('pedidos', $pedido['id'], ['avisado' => gg_ahora()]);
    } catch (Throwable $e) {
        error_log('[GOOD GAME] Aviso de pedido no enviado: ' . $e->getMessage());
    }
}

/** Las líneas de un pedido, para los correos. */
function gg_pago_lineas(string $pedidoId): array
{
    return gg_filas('SELECT * FROM pedido_lineas WHERE pedido_id = ?', [$pedidoId]);
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/pago/preparar
// ─────────────────────────────────────────────────────────────────────────────

if ($accion === 'preparar' && $metodo === 'POST') {
    $cfg = gg_pago_config();

    if (!$cfg['activo']) {
        throw new GgError('El pago en línea no está disponible ahora mismo.', 409);
    }
    // En modo checkout hacen falta las dos llaves. Le pasa al negocio, no al
    // comprador, pero el comprador es quien lo ve: por eso el mensaje no habla
    // de llaves ni de configuración.
    if ($cfg['modo'] === 'checkout' && ($cfg['llave'] === '' || $cfg['integridad'] === '')) {
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

    // ── Quién compra y a dónde se le manda ───────────────────────────────────
    $datosCliente = is_array($cuerpo['cliente'] ?? null) ? $cuerpo['cliente'] : [];
    $cliente = gg_pago_cliente($datosCliente);
    $direccion = gg_texto($datosCliente, 'direccion', 200);

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
            'cliente_id'  => $cliente['id'] ?? null,
            'estado'      => 'pendiente',
            'pago'        => $cfg['proveedor'],
            'canal'       => 'web',
            'subtotal'    => $subtotal,
            'envio'       => 0,
            'total'       => $subtotal,
            'notas'       => 'Pedido creado por la tienda al iniciar el pago en línea.',
            'direccion'   => $direccion !== '' ? $direccion : null,
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

    // El aviso sale ya, sin esperar al pago: así el negocio sabe qué le están
    // pidiendo aunque el cliente se arrepienta a mitad de la pasarela.
    $pedidoGuardado = gg_fila('SELECT * FROM pedidos WHERE id = ?', [$pedidoId]);
    gg_pago_avisar($pedidoGuardado, $lineas, $cliente, 'nuevo');

    // ── Modo enlace ─────────────────────────────────────────────────────────
    // No hay nada que firmar: el cliente escribe el total en la pasarela. Lo
    // que cambia respecto a antes es que el pedido YA quedó registrado y con
    // nombre, así que la referencia sirve para algo.
    if ($cfg['modo'] !== 'checkout') {
        gg_responder([
            'modo'       => 'enlace',
            'enlace'     => $cfg['enlace'],
            'pedido'     => $codigo,
            'referencia' => $codigo,
            'total'      => $subtotal,
        ], 201);
    }

    // ── Modo checkout ───────────────────────────────────────────────────────
    // Wompi trabaja en centavos. El catálogo está en pesos enteros.
    $centavos = $subtotal * 100;

    $campos = [
        'public-key'          => $cfg['llave'],
        'currency'            => 'COP',
        'amount-in-cents'     => (string) $centavos,
        'reference'           => $referencia,
        'signature:integrity' => gg_pago_firma($referencia, $centavos, 'COP', $cfg['integridad']),
        'redirect-url'        => gg_url_sitio() . '/pago',
    ];

    // Se le pasan los datos a la pasarela para que el cliente no los reescriba.
    // Van fuera de la firma: Wompi solo firma referencia, importe y moneda.
    if ($cliente) {
        $campos['customer-data:full-name'] = (string) $cliente['nombre'];
        $campos['customer-data:phone-number'] = (string) $cliente['whatsapp'];
        if (($cliente['email'] ?? '') !== '') {
            $campos['customer-data:email'] = (string) $cliente['email'];
        }
        if ($direccion !== '') {
            $campos['shipping-address:address-line-1'] = $direccion;
            $campos['shipping-address:country'] = 'CO';
            $campos['shipping-address:phone-number'] = (string) $cliente['whatsapp'];
            $campos['shipping-address:city'] = (string) ($cliente['ciudad'] ?? '');
            $campos['shipping-address:region'] = (string) ($cliente['ciudad'] ?? '');
        }
    }

    gg_responder([
        'modo'   => 'checkout',
        'url'    => GG_WOMPI_CHECKOUT,
        'pedido' => $codigo,
        'total'  => $subtotal,
        // Estos son los campos del formulario, tal cual. La firma se calculó
        // aquí: el navegador no ve el secreto ni puede rehacerla.
        'campos' => $campos,
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
        $cambia = $nuevoEstado !== $pedido['estado'] || ($pedido['pago_id'] ?? '') !== $id;

        // Solo se escribe si algo cambió: volver a cargar la página de retorno
        // no debe ensuciar el historial ni tocar la fecha del pedido.
        if ($cambia) {
            $cols = [
                'estado'      => $nuevoEstado,
                'pago_id'     => $id,
                'actualizado' => gg_ahora(),
            ];

            // La pasarela sabe a dónde enviar aunque el cliente no lo hubiera
            // escrito en la tienda. Solo se rellena lo que falte: lo que el
            // cliente escribió aquí manda sobre lo que puso allá.
            $envio = $t['shipping_address'] ?? null;
            if (is_array($envio) && trim((string) ($pedido['direccion'] ?? '')) === '') {
                $calle = trim(
                    (string) ($envio['address_line_1'] ?? '') . ' ' .
                    (string) ($envio['address_line_2'] ?? '')
                );
                $ciudadEnvio = trim((string) ($envio['city'] ?? ''));
                $completa = trim($calle . ($ciudadEnvio !== '' ? ', ' . $ciudadEnvio : ''));
                if ($completa !== '') {
                    $cols['direccion'] = mb_substr($completa, 0, 200);
                }
            }

            gg_actualizar('pedidos', $pedido['id'], $cols);
            gg_auditar(
                'actualizar',
                'pedidos',
                $pedido['id'],
                (string) $pedido['codigo'],
                ['pago' => ['antes' => $pedido['estado'], 'ahora' => $nuevoEstado . ' · ' . $estado]]
            );

            // ── El aviso de «ya pagó» ───────────────────────────────────────
            // Solo cuando el pedido pasa a confirmado de verdad, y una sola vez:
            // recargar la página de retorno no puede volver a sonar el correo.
            if ($nuevoEstado === 'confirmado' && $pedido['estado'] !== 'confirmado') {
                $frescos = gg_fila('SELECT * FROM pedidos WHERE id = ?', [$pedido['id']]);
                $suCliente = $frescos['cliente_id'] !== null
                    ? gg_fila('SELECT * FROM clientes WHERE id = ?', [$frescos['cliente_id']])
                    : null;
                gg_pago_avisar($frescos, gg_pago_lineas($pedido['id']), $suCliente, 'pagado');

                // Y el stock se descuenta solo, igual que si el administrador
                // hubiera confirmado el pedido a mano desde el panel. El aviso
                // al cliente ya salió arriba con el correo de «pago aprobado»,
                // así que aquí solo interesa el inventario.
                try {
                    $movimiento = gg_stock_sincronizar(
                        gg_fila('SELECT * FROM pedidos WHERE id = ?', [$pedido['id']]),
                        'confirmado'
                    );
                    if ($movimiento !== 'sin cambios') {
                        gg_auditar(
                            'actualizar',
                            'pedidos',
                            (string) $pedido['id'],
                            (string) $pedido['codigo'],
                            ['stock' => ['antes' => 'pago aprobado', 'ahora' => $movimiento]]
                        );
                    }
                } catch (Throwable $e) {
                    // El dinero ya entró: un tropiezo del inventario no puede
                    // hacer que el cliente vea un error tras haber pagado.
                    error_log('[GOOD GAME] Stock no aplicado: ' . $e->getMessage());
                }
            }
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

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/pago/probar-correo
//
// Manda un correo de prueba a la dirección de avisos. Existe porque el envío
// desde un hosting compartido falla de formas que no se ven: la dirección mal
// escrita, el correo en spam, mail() apagado. Vale más descubrirlo pulsando un
// botón que con la primera venta de verdad.
//
// Solo para quien ya entra a los ajustes, y así no se convierte en una forma de
// que un desconocido mande correos desde este servidor.
// ─────────────────────────────────────────────────────────────────────────────

if ($accion === 'probar-correo' && $metodo === 'POST') {
    gg_exigir_rol('super_admin');

    $para = trim((string) (gg_opciones('ajustes')['payments']['orderEmail'] ?? ''));
    if ($para === '') {
        throw new GgError('Escribe primero la dirección a la que quieres los avisos.', 400);
    }

    $ok = gg_correo_enviar(
        $para,
        'Prueba de avisos · GOOD GAME',
        gg_correo_plantilla(
            'El aviso funciona',
            'Si estás leyendo esto, los correos de pedido te van a llegar a esta dirección.',
            '<p style="margin:0;font-size:13.5px;line-height:1.6;color:#565a7a;">'
            . 'Cuando alguien compre, aquí verás qué pidió, quién es y a dónde enviarlo.</p>',
            '<a href="' . gg_url_sitio() . '/admin/ajustes" style="display:inline-block;padding:10px 18px;'
            . 'background:#070A78;color:#ffffff;text-decoration:none;border-radius:9px;font-size:13.5px;'
            . 'font-weight:700;">Volver a los ajustes</a>'
        ),
        "El aviso funciona.\n\nSi estás leyendo esto, los correos de pedido te van a llegar\n"
        . "a esta dirección.\n\nGOOD GAME · " . gg_url_sitio() . "\n"
    );

    if (!$ok) {
        throw new GgError(
            'El servidor no pudo enviar el correo. Puede que este hosting tenga el envío ' .
            'desactivado: revísalo en hPanel → Correos.',
            502
        );
    }

    gg_responder([
        'ok'      => true,
        'para'    => $para,
        'mensaje' => 'Correo enviado. Si no llega en un par de minutos, mira en la carpeta de spam.',
    ]);
}

gg_error('No existe esa dirección en la API.', 404);

<?php
declare(strict_types=1);

/**
 * GOOD GAME · Lo que un pedido hace solo al cambiar de estado
 *
 * Dos cosas que antes tocaba hacer a mano después de cada venta:
 *
 *   · descontar el stock de lo vendido;
 *   · avisarle al cliente de que su pedido va en camino.
 *
 * Vive aparte de las rutas porque lo disparan DOS sitios distintos: el panel,
 * cuando el administrador cambia el estado a mano, y la vuelta de la pasarela,
 * cuando un pago aprobado confirma el pedido solo. La regla tiene que ser la
 * misma en los dos casos, y una regla escrita dos veces se separa.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Stock
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estados en los que el producto ya está comprometido con este cliente.
 *
 * «pendiente» NO está: un carrito que empezó a pagar y se abandonó no puede
 * dejar el producto bloqueado para siempre. Y «cancelado» tampoco, que es lo
 * que devuelve las unidades al inventario.
 */
function gg_estado_consume_stock(string $estado): bool
{
    return in_array($estado, ['confirmado', 'preparando', 'enviado', 'entregado'], true);
}

/**
 * Pone el stock al día según el estado del pedido.
 *
 * Es idempotente: la columna `stock_aplicado` recuerda si ya se descontó, así
 * que marcar dos veces el mismo pedido como confirmado —o recargar la página de
 * retorno de la pasarela— no descuenta el doble.
 *
 * Nunca baja de cero. Si el negocio vendió por fuera y el inventario ya estaba
 * en 0, el pedido se confirma igual y el stock se queda en 0: es preferible un
 * inventario que hay que revisar a una venta que la tienda se niega a registrar.
 *
 * Devuelve qué hizo, para poder anotarlo en el historial.
 */
function gg_stock_sincronizar(array $pedido, string $estadoNuevo): string
{
    $yaAplicado = (int) ($pedido['stock_aplicado'] ?? 0) === 1;
    $debeAplicar = gg_estado_consume_stock($estadoNuevo);

    if ($yaAplicado === $debeAplicar) {
        return 'sin cambios';
    }

    $lineas = gg_filas(
        'SELECT producto_id, cantidad FROM pedido_lineas WHERE pedido_id = ?',
        [$pedido['id']]
    );

    $db = gg_db();
    $propia = !$db->inTransaction();
    if ($propia) {
        $db->beginTransaction();
    }

    try {
        foreach ($lineas as $l) {
            if ($l['producto_id'] === null) {
                // Una línea suelta que el administrador escribió a mano: no
                // apunta a ningún producto del catálogo, así que no hay stock
                // que mover.
                continue;
            }
            $cantidad = (int) $l['cantidad'];

            if ($debeAplicar) {
                // MAX(0, …) en el propio SQL: si dos pedidos del último
                // ejemplar se confirman a la vez, ninguno deja el stock en
                // negativo. La resta ocurre dentro de la base, no leyendo y
                // volviendo a escribir desde PHP, que es donde se cuelan las
                // carreras.
                gg_ejecutar(
                    'UPDATE productos SET stock = MAX(0, stock - ?), actualizado = ?
                     WHERE id = ? AND stock IS NOT NULL',
                    [$cantidad, gg_ahora(), $l['producto_id']]
                );
            } else {
                gg_ejecutar(
                    'UPDATE productos SET stock = stock + ?, actualizado = ?
                     WHERE id = ? AND stock IS NOT NULL',
                    [$cantidad, gg_ahora(), $l['producto_id']]
                );
            }
        }

        gg_actualizar('pedidos', $pedido['id'], [
            'stock_aplicado' => $debeAplicar ? 1 : 0,
            'actualizado'    => gg_ahora(),
        ]);

        if ($propia) {
            $db->commit();
        }
    } catch (Throwable $e) {
        if ($propia && $db->inTransaction()) {
            $db->rollBack();
        }
        throw $e;
    }

    return $debeAplicar ? 'descontado del inventario' : 'devuelto al inventario';
}

// ─────────────────────────────────────────────────────────────────────────────
// Aviso al cliente
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Qué se le cuenta al cliente en cada estado.
 *
 * Los que no están aquí —«pendiente», «preparando»— no generan correo a
 * propósito: son movimientos internos del negocio y llenarle el buzón al
 * cliente de avisos que no le dicen nada acaba en la carpeta de spam.
 */
function gg_pedido_aviso_cliente(string $estado, ?string $guia): ?array
{
    return match ($estado) {
        'confirmado' => [
            'asunto' => 'Tu pedido está confirmado',
            'titulo' => 'Confirmamos tu pedido',
            'texto'  => 'Ya lo estamos preparando. Te avisamos otra vez en cuanto salga.',
        ],
        'enviado' => [
            'asunto' => 'Tu pedido va en camino',
            'titulo' => '¡Tu pedido va en camino!',
            'texto'  => $guia !== null && trim($guia) !== ''
                ? 'Ya lo despachamos. Tu número de guía es ' . trim($guia) . '.'
                : 'Ya lo despachamos. Si necesitas el número de guía, escríbenos.',
        ],
        'entregado' => [
            'asunto' => 'Tu pedido fue entregado',
            'titulo' => '¡Gracias por comprar con nosotros!',
            'texto'  => 'Nos aparece como entregado. Si algo no llegó bien, escríbenos y lo resolvemos.',
        ],
        'cancelado' => [
            'asunto' => 'Tu pedido fue cancelado',
            'titulo' => 'Tu pedido quedó cancelado',
            'texto'  => 'Si no lo pediste tú o crees que es un error, escríbenos y lo revisamos.',
        ],
        default => null,
    };
}

/**
 * Le escribe al cliente contándole en qué va su pedido.
 *
 * Se traga cualquier fallo: el pedido ya cambió de estado y el negocio ya hizo
 * su trabajo. Que el correo no salga es un problema, pero no es motivo para que
 * el panel devuelva un error al administrador que acaba de despachar.
 */
function gg_pedido_avisar_cliente(array $pedido, string $estadoNuevo): bool
{
    try {
        $ajustes = gg_opciones('ajustes')['payments'] ?? [];
        if (!gg_bool($ajustes['emailCustomer'] ?? false)) {
            return false;
        }

        $cliente = $pedido['cliente_id'] !== null
            ? gg_fila('SELECT * FROM clientes WHERE id = ?', [$pedido['cliente_id']])
            : null;

        $para = trim((string) ($cliente['email'] ?? ''));
        if ($para === '') {
            return false;
        }

        $aviso = gg_pedido_aviso_cliente($estadoNuevo, $pedido['guia'] ?? null);
        if ($aviso === null) {
            return false;
        }

        $lineas = gg_filas('SELECT * FROM pedido_lineas WHERE pedido_id = ?', [$pedido['id']]);
        $codigo = (string) $pedido['codigo'];

        $html = gg_correo_plantilla(
            $aviso['titulo'],
            $aviso['texto'],
            gg_correo_ficha([
                'Pedido' => $codigo,
                'Guía'   => $pedido['guia'] ?? '',
                'Envío'  => $pedido['direccion'] ?? '',
            ]) . gg_correo_lineas($lineas, (int) $pedido['total']),
            '<p style="margin:0;font-size:13px;color:#565a7a;">¿Alguna duda? Escríbenos por '
                . 'WhatsApp al ' . gg_e(gg_correo_whatsapp_visible()) . '.</p>'
        );

        $texto = $aviso['titulo'] . "\n\n" . $aviso['texto'] . "\n\n"
            . "Pedido: $codigo\n"
            . (($pedido['guia'] ?? '') !== '' ? 'Guía: ' . $pedido['guia'] . "\n" : '')
            . str_repeat('-', 40) . "\n";
        foreach ($lineas as $l) {
            $texto .= sprintf(
                "%d× %s\n",
                (int) $l['cantidad'],
                (string) $l['nombre']
            );
        }
        $texto .= "\nGOOD GAME · " . gg_url_sitio() . "\n";

        return gg_correo_enviar($para, $aviso['asunto'] . ' · ' . $codigo, $html, $texto);
    } catch (Throwable $e) {
        error_log('[GOOD GAME] Aviso de estado no enviado: ' . $e->getMessage());
        return false;
    }
}

/**
 * Todo lo que dispara un cambio de estado, en un solo sitio.
 *
 * Se llama DESPUÉS de haber guardado el estado nuevo, con la ficha ya fresca.
 */
function gg_pedido_al_cambiar_estado(array $pedidoFresco, string $estadoAnterior, string $estadoNuevo): void
{
    if ($estadoAnterior === $estadoNuevo) {
        return;
    }

    $movimiento = gg_stock_sincronizar($pedidoFresco, $estadoNuevo);
    if ($movimiento !== 'sin cambios') {
        gg_auditar(
            'actualizar',
            'pedidos',
            (string) $pedidoFresco['id'],
            (string) $pedidoFresco['codigo'],
            ['stock' => ['antes' => $estadoAnterior, 'ahora' => $movimiento]]
        );
    }

    gg_pedido_avisar_cliente($pedidoFresco, $estadoNuevo);
}

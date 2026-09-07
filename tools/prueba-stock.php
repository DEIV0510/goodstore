<?php
declare(strict_types=1);

/**
 * Comprueba que el stock se mueve solo, y solo una vez.
 *
 *   php tools/prueba-stock.php
 *
 * Descontar inventario es de las pocas cosas del sistema que, si se hace dos
 * veces, deja al negocio creyendo que no tiene lo que sí tiene. Y si no se hace,
 * le vende a dos personas el último ejemplar. Ninguna de las dos cosas se ve
 * mirando la pantalla: hay que contar unidades antes y después.
 *
 * Este archivo vive en tools/ y no se publica nunca.
 */

$tmp = sys_get_temp_dir() . '/gg-prueba-stock-' . bin2hex(random_bytes(4));
$_SERVER['DOCUMENT_ROOT'] = $tmp . '/publico';  // gg_carpeta_datos() usa dirname(): así el gg-datos cae DENTRO del temporal
mkdir($tmp . '/publico', 0777, true);

require __DIR__ . '/../public/api/nucleo/config.php';
require __DIR__ . '/../public/api/nucleo/http.php';
require __DIR__ . '/../public/api/nucleo/db.php';
require __DIR__ . '/../public/api/nucleo/salidas.php';
require __DIR__ . '/../public/api/nucleo/auditoria.php';
require __DIR__ . '/../public/api/nucleo/correo.php';
require __DIR__ . '/../public/api/nucleo/pedidos-auto.php';

$fallos = 0;
$comprobar = static function (bool $bien, string $texto) use (&$fallos): void {
    printf("%s  %s\n", $bien ? 'OK   ' : 'FALLA', $texto);
    if (!$bien) {
        $fallos++;
    }
};

// ── Un producto con 5 unidades y un pedido de 2 ──────────────────────────────
$ahora = gg_ahora();
$prodId = gg_id();
gg_insertar('productos', [
    'id' => $prodId, 'slug' => 'juego-prueba', 'nombre' => 'Juego de prueba',
    'plataforma' => 'ps4', 'precio' => 50000, 'stock' => 5,
    'creado' => $ahora, 'actualizado' => $ahora,
]);

$pedidoId = gg_id();
gg_insertar('pedidos', [
    'id' => $pedidoId, 'codigo' => 'GG-PRUEBA-0001', 'estado' => 'pendiente',
    'canal' => 'web', 'subtotal' => 100000, 'envio' => 0, 'total' => 100000,
    'creado' => $ahora, 'actualizado' => $ahora,
]);
gg_insertar('pedido_lineas', [
    'id' => gg_id(), 'pedido_id' => $pedidoId, 'producto_id' => $prodId,
    'nombre' => 'Juego de prueba', 'precio_unit' => 50000, 'cantidad' => 2,
]);

$stock = static fn(): int => (int) gg_valor('SELECT stock FROM productos WHERE id = ?', [$prodId]);
$recargar = static fn(): array => gg_fila('SELECT * FROM pedidos WHERE id = ?', [$pedidoId]);

$comprobar($stock() === 5, 'arranca con 5 unidades');

// ── Pendiente NO descuenta: un carrito abandonado no bloquea inventario ──────
gg_stock_sincronizar($recargar(), 'pendiente');
$comprobar($stock() === 5, 'un pedido «pendiente» no descuenta nada');

// ── Confirmado descuenta ─────────────────────────────────────────────────────
gg_stock_sincronizar($recargar(), 'confirmado');
$comprobar($stock() === 3, 'al confirmar quedan 3 (5 − 2)');

// ── Y no descuenta dos veces ─────────────────────────────────────────────────
gg_stock_sincronizar($recargar(), 'confirmado');
gg_stock_sincronizar($recargar(), 'preparando');
gg_stock_sincronizar($recargar(), 'enviado');
$comprobar($stock() === 3, 'confirmar/preparar/enviar NO vuelve a descontar');

// ── Cancelar devuelve ────────────────────────────────────────────────────────
gg_stock_sincronizar($recargar(), 'cancelado');
$comprobar($stock() === 5, 'al cancelar vuelven las 2 unidades');

gg_stock_sincronizar($recargar(), 'cancelado');
$comprobar($stock() === 5, 'cancelar dos veces no infla el inventario');

// ── Reabrir vuelve a descontar ───────────────────────────────────────────────
gg_stock_sincronizar($recargar(), 'entregado');
$comprobar($stock() === 3, 'reabrir el pedido vuelve a descontar');

// ── Nunca por debajo de cero ─────────────────────────────────────────────────
// El negocio vendió por fuera y dejó el inventario en 1; un pedido de 2 no
// puede dejarlo en −1.
gg_stock_sincronizar($recargar(), 'cancelado');
gg_ejecutar('UPDATE productos SET stock = 1 WHERE id = ?', [$prodId]);
gg_stock_sincronizar($recargar(), 'confirmado');
$comprobar($stock() === 0, 'con menos stock del vendido se queda en 0, nunca en negativo');

// ── Un producto sin stock definido (null) se deja en paz ────────────────────
gg_ejecutar('UPDATE productos SET stock = NULL WHERE id = ?', [$prodId]);
gg_stock_sincronizar($recargar(), 'cancelado');
$sinDefinir = gg_valor('SELECT stock FROM productos WHERE id = ?', [$prodId]);
$comprobar($sinDefinir === null, 'un producto sin stock definido sigue sin definir');

// Limpieza.
foreach (glob($tmp . '/gg-datos/*') ?: [] as $f) {
    @unlink($f);
}
@rmdir($tmp . '/gg-datos');
@rmdir($tmp);

echo $fallos === 0
    ? "\nEl inventario se mueve solo, y solo una vez.\n"
    : "\n$fallos fallo(s). NO publiques así.\n";

exit($fallos === 0 ? 0 : 1);

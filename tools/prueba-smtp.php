<?php
declare(strict_types=1);

/**
 * Comprueba el cliente SMTP escrito a mano.
 *
 *   php tools/prueba-smtp.php
 *
 * De todo lo que hace este cliente, lo que se rompe en silencio es el armado
 * del mensaje: un final de línea equivocado o un punto sin escapar no dan
 * error, simplemente entregan un correo cortado o no lo entregan. Y eso no se
 * ve mirando la pantalla, porque el envío devuelve «aceptado» igual.
 *
 * El diálogo con el servidor se comprueba con flujos en memoria, sin red.
 *
 * Este archivo vive en tools/ y no se publica nunca.
 */

$tmp = sys_get_temp_dir() . '/gg-prueba-smtp-' . bin2hex(random_bytes(4));
$_SERVER['DOCUMENT_ROOT'] = $tmp . '/publico';
mkdir($tmp . '/publico', 0777, true);

require __DIR__ . '/../public/api/nucleo/config.php';
require __DIR__ . '/../public/api/nucleo/http.php';
require __DIR__ . '/../public/api/nucleo/db.php';
require __DIR__ . '/../public/api/nucleo/salidas.php';
require __DIR__ . '/../public/api/nucleo/smtp.php';

$fallos = 0;
$comprobar = static function (bool $bien, string $texto) use (&$fallos): void {
    printf("%s  %s\n", $bien ? 'OK   ' : 'FALLA', $texto);
    if (!$bien) {
        $fallos++;
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// El mensaje
// ─────────────────────────────────────────────────────────────────────────────

$msg = gg_smtp_mensaje(
    'no-responder@goodgamecol.shop',
    'admin@ejemplo.test',
    '=?UTF-8?B?UGVkaWRvIG51ZXZv?=',
    ['MIME-Version: 1.0', 'From: GOOD GAME <no-responder@goodgamecol.shop>'],
    "Hola\r\n.punto al principio\r\nfin",
    'idfijo'
);

$comprobar(str_contains($msg, "\r\nTo: admin@ejemplo.test\r\n"), 'lleva la cabecera To');
$comprobar(
    str_contains($msg, "\r\nSubject: =?UTF-8?B?UGVkaWRvIG51ZXZv?=\r\n"),
    'lleva el asunto ya codificado, sin tocar'
);
$comprobar(str_contains($msg, 'Message-ID: <idfijo@goodgamecol.shop>'), 'el Message-ID usa el dominio del remitente');
$comprobar(str_starts_with($msg, 'Date: '), 'abre con la fecha (por SMTP no la pone nadie más)');
$comprobar(str_contains($msg, "\r\nFrom: GOOD GAME <no-responder@goodgamecol.shop>"), 'conserva las cabeceras que le pasan');

// La separación entre cabeceras y cuerpo es una línea en blanco, y solo una.
$comprobar(str_contains($msg, "\r\n\r\nHola"), 'una línea en blanco separa cabeceras y cuerpo');

// ── Lo que de verdad importa ────────────────────────────────────────────────
$comprobar(
    str_contains($msg, "\r\n..punto al principio\r\n"),
    'un punto al principio de línea se duplica (si no, corta el correo ahí)'
);
$comprobar(
    !preg_match('/(?<!\r)\n/', $msg),
    'no queda ni un salto de línea suelto: todos son CRLF'
);

// Y el caso extremo: un cuerpo que empieza por punto en su primera línea.
$msg2 = gg_smtp_mensaje('a@b.test', 'c@d.test', 'x', [], ".solo", 'i');
$comprobar(str_contains($msg2, "\r\n\r\n..solo"), 'también se escapa el punto de la primera línea del cuerpo');

// ─────────────────────────────────────────────────────────────────────────────
// El diálogo: respuestas de varias líneas
// ─────────────────────────────────────────────────────────────────────────────

$flujo = static function (string $contenido) {
    $f = fopen('php://memory', 'r+');
    fwrite($f, $contenido);
    rewind($f);
    return $f;
};

[$codigo, $texto] = gg_smtp_leer($flujo("250-servidor\r\n250-AUTH LOGIN PLAIN\r\n250 OK\r\n"));
$comprobar($codigo === 250, 'lee el código de una respuesta de varias líneas');
$comprobar(str_contains($texto, 'AUTH LOGIN'), 'devuelve las líneas intermedias (ahí se anuncia AUTH)');

[$codigo2] = gg_smtp_leer($flujo("535 usuario o clave incorrectos\r\n"));
$comprobar($codigo2 === 535, 'lee un código de error de una sola línea');

// Una respuesta inesperada tiene que cortar, no seguir hablando.
$corto = false;
try {
    gg_smtp_ordenar($flujo("535 no\r\n"), null, [235], 'contraseña');
} catch (Throwable $e) {
    $corto = str_contains($e->getMessage(), 'contraseña');
}
$comprobar($corto, 'una respuesta inesperada corta el envío y dice en qué paso');

// ─────────────────────────────────────────────────────────────────────────────
// La configuración: sin las cuatro piezas, no se usa SMTP
// ─────────────────────────────────────────────────────────────────────────────

gg_guardar_opcion('ajustes', 'payments', [
    'smtpEnabled' => true,
    'smtpHost'    => 'smtp.hostinger.com',
    'smtpPort'    => 465,
    'smtpUser'    => 'no-responder@goodgamecol.shop',
]);
$comprobar(gg_smtp_config()['activo'] === false, 'sin contraseña guardada, el SMTP no se da por activo');

gg_guardar_opcion('secretos', 'smtpClave', 'la-clave');
$comprobar(gg_smtp_config()['activo'] === true, 'con las cuatro piezas, se activa');

gg_guardar_opcion('ajustes', 'payments', [
    'smtpEnabled' => false,
    'smtpHost'    => 'smtp.hostinger.com',
    'smtpPort'    => 465,
    'smtpUser'    => 'no-responder@goodgamecol.shop',
]);
$comprobar(gg_smtp_config()['activo'] === false, 'con el interruptor apagado, no se usa aunque esté todo puesto');

// Y con el interruptor encendido pero sin servidor, tampoco: caería a mail().
gg_guardar_opcion('ajustes', 'payments', [
    'smtpEnabled' => true,
    'smtpHost'    => '',
    'smtpPort'    => 465,
    'smtpUser'    => 'no-responder@goodgamecol.shop',
]);
$comprobar(gg_smtp_config()['activo'] === false, 'sin servidor no se activa: mejor mail() que nada');

// Limpieza.
foreach (glob($tmp . '/gg-datos/*') ?: [] as $f) {
    @unlink($f);
}
@rmdir($tmp . '/gg-datos');
@rmdir($tmp . '/publico');
@rmdir($tmp);

echo $fallos === 0
    ? "\nEl cliente SMTP arma bien el mensaje y corta cuando debe.\n"
    : "\n$fallos fallo(s). NO publiques así.\n";

exit($fallos === 0 ? 0 : 1);

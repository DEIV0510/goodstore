<?php
declare(strict_types=1);

/**
 * Comprueba que /api/publico no filtra nada privado.
 *
 *   php tools/prueba-fuga-publica.php
 *
 * /api/publico es la ÚNICA dirección que responde sin sesión, y devuelve el
 * bloque de ajustes entero. Ese bloque va creciendo, y es muy fácil añadirle un
 * campo del negocio —un correo, una llave, un teléfono interno— sin caer en que
 * queda publicado para cualquiera que abra la dirección en el navegador.
 *
 * La prueba llena la base con valores reconocibles y luego los busca en la
 * respuesta. Es la única forma de que esto salte solo.
 *
 * Se ejecuta en dos pasos: la ruta termina el proceso al responder, así que se
 * la llama en un PHP aparte y aquí se examina lo que escribió.
 *
 * Este archivo vive en tools/ y no se publica nunca.
 */

$privados = [
    'orderEmail' => 'NO-DEBE-SALIR-correo@ejemplo.test',
];
$publicos = [
    'enabled'   => true,
    'mode'      => 'checkout',
    'provider'  => 'Nequi',
    'link'      => 'https://checkout.example.test/l/abc',
    'publicKey' => 'pub_test_DEBE-SALIR-1234567890',
];
$secreto = 'test_integrity_NO-DEBE-SALIR-123456';

// ─────────────────────────────────────────────────────────────────────────────
// Paso 2 (el hijo): monta una base de mentira y deja que la ruta responda.
// ─────────────────────────────────────────────────────────────────────────────
if (($argv[1] ?? '') === '--servir') {
    $tmp = $argv[2];
    $_SERVER['DOCUMENT_ROOT'] = $tmp . '/publico';  // gg_carpeta_datos() usa dirname(): así el gg-datos cae DENTRO del temporal

    require __DIR__ . '/../public/api/nucleo/config.php';
    require __DIR__ . '/../public/api/nucleo/http.php';
    require __DIR__ . '/../public/api/nucleo/db.php';
    require __DIR__ . '/../public/api/nucleo/salidas.php';

    gg_guardar_opcion('ajustes', 'payments', $publicos + $privados);
    // El secreto vive en otro grupo; se guarda para comprobar que ese grupo
    // tampoco asoma por ningún lado.
    gg_guardar_opcion('secretos', 'wompiIntegridad', $secreto);

    $ruta = ['publico'];
    require __DIR__ . '/../public/api/rutas/publico.php';
    exit;
}

// ─────────────────────────────────────────────────────────────────────────────
// Paso 1 (el padre): lanza al hijo y examina lo que devolvió.
// ─────────────────────────────────────────────────────────────────────────────
$tmp = sys_get_temp_dir() . '/gg-prueba-fuga-' . bin2hex(random_bytes(4));
mkdir($tmp . '/publico', 0777, true);

$cmd = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__FILE__)
    . ' --servir ' . escapeshellarg($tmp) . ' 2>&1';
$respuesta = (string) shell_exec($cmd);

$fallos = 0;
$comprobar = static function (bool $bien, string $texto) use (&$fallos): void {
    printf("%s  %s\n", $bien ? 'OK   ' : 'FALLA', $texto);
    if (!$bien) {
        $fallos++;
    }
};

$comprobar(str_contains($respuesta, '"productos"'), '/api/publico respondió');

foreach ($privados as $clave => $valor) {
    $comprobar(
        !str_contains($respuesta, $valor) && !str_contains($respuesta, $clave),
        "«{$clave}» NO sale en la respuesta pública"
    );
}

$comprobar(
    !str_contains($respuesta, 'test_integrity_') && !str_contains($respuesta, 'wompiIntegridad'),
    'el secreto de integridad NO sale'
);

// Y que lo que SÍ necesita la tienda siga saliendo: una prueba que solo quite
// cosas acabaría rompiendo el carrito sin avisar.
foreach (['pub_test_DEBE-SALIR-1234567890', 'checkout.example.test', '"enabled":true'] as $debeSalir) {
    $comprobar(
        str_contains($respuesta, $debeSalir),
        'la tienda sigue recibiendo ' . substr($debeSalir, 0, 26)
    );
}

foreach (glob($tmp . '/gg-datos/*') ?: [] as $f) {
    @unlink($f);
}
@rmdir($tmp . '/gg-datos');
@rmdir($tmp);

echo $fallos === 0
    ? "\nLa ruta pública no filtra nada privado.\n"
    : "\n$fallos fuga(s) o rotura(s). NO publiques así.\n";

exit($fallos === 0 ? 0 : 1);

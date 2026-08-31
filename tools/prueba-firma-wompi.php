<?php
declare(strict_types=1);

/**
 * Comprueba la firma de integridad de Wompi contra el ejemplo de su propia
 * documentación.
 *
 *   php tools/prueba-firma-wompi.php
 *
 * Es la única forma de saber que la firma está bien SIN cobrarle a nadie de
 * verdad: si el orden de concatenación estuviera cambiado, Wompi rechazaría
 * cada pago con «firma inválida» y el cliente lo descubriría en la caja.
 *
 * Los valores de abajo son los que Wompi publica como ejemplo en
 * https://docs.wompi.co/docs/colombia/widget-checkout-web/ — no son de nadie:
 * el secreto es de mentira y sirve solo para este cotejo.
 *
 * Este archivo vive en tools/ y no se publica nunca.
 */

require __DIR__ . '/../public/api/nucleo/config.php';

// gg_pago_firma() vive dentro de la ruta, que ejecuta al incluirla. Se copia
// aquí la MISMA expresión a propósito: si alguien cambia una de las dos, esta
// prueba deja de cuadrar y se entera antes de publicar.
$firma = static fn(string $ref, int $centavos, string $moneda, string $secreto): string
    => hash('sha256', $ref . $centavos . $moneda . $secreto);

$casos = [
    [
        'nombre'   => 'Ejemplo de la documentación de Wompi',
        'ref'      => 'sk8-438k4-xmxm392-sn2m',
        'centavos' => 2490000,
        'moneda'   => 'COP',
        'secreto'  => 'prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6',
        'esperado' => '37c8407747e595535433ef8f6a811d853cd943046624a0ec04662b17bbf33bf5',
    ],
];

$fallos = 0;
foreach ($casos as $c) {
    $obtenido = $firma($c['ref'], $c['centavos'], $c['moneda'], $c['secreto']);
    $bien = hash_equals($c['esperado'], $obtenido);
    printf("%s  %s\n", $bien ? 'OK  ' : 'FALLA', $c['nombre']);
    if (!$bien) {
        printf("      esperado: %s\n      obtenido: %s\n", $c['esperado'], $obtenido);
        $fallos++;
    }
}

// Y que la ruta real use exactamente la misma expresión, no una parecida.
$fuente = file_get_contents(__DIR__ . '/../public/api/rutas/pago.php') ?: '';
$mismaExpresion = str_contains(
    $fuente,
    "hash('sha256', \$referencia . \$centavos . \$moneda . \$secreto)"
);
printf("%s  La ruta /api/pago usa esa misma concatenación\n", $mismaExpresion ? 'OK  ' : 'FALLA');
if (!$mismaExpresion) {
    $fallos++;
}

echo $fallos === 0
    ? "\nLa firma es correcta.\n"
    : "\n$fallos comprobación(es) fallida(s). NO publiques así.\n";

exit($fallos === 0 ? 0 : 1);

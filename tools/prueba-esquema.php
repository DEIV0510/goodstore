<?php
declare(strict_types=1);

/**
 * Comprueba que una base INSTALADA DESDE CERO y una base ANTIGUA MIGRADA
 * acaban con exactamente el mismo esquema.
 *
 *   php tools/prueba-esquema.php
 *
 * Existe por un fallo real: las columnas del pago en línea se añadieron a la
 * tabla equivocada en el CREATE TABLE mientras el ALTER de la migración sí
 * apuntaba a la buena. En producción funcionaba —porque venía migrando— y una
 * instalación limpia se habría roto al primer pedido. Ese desajuste no lo
 * detecta ninguna prueba funcional: hay que comparar los dos caminos.
 *
 * Este archivo vive en tools/ y no se publica nunca.
 */

$tmp = sys_get_temp_dir() . '/gg-prueba-esquema-' . bin2hex(random_bytes(4));
mkdir($tmp, 0777, true);
putenv('GG_CARPETA_DATOS=' . $tmp);

require __DIR__ . '/../public/api/nucleo/config.php';
require __DIR__ . '/../public/api/nucleo/db.php';

/** Columnas de cada tabla, en un texto comparable. */
function esquema(PDO $db): array
{
    $salida = [];
    $tablas = $db->query(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )->fetchAll(PDO::FETCH_COLUMN);

    foreach ($tablas as $t) {
        $cols = [];
        foreach ($db->query("PRAGMA table_info($t)") as $c) {
            $cols[] = $c['name'] . ' ' . $c['type'];
        }
        sort($cols);
        $salida[$t] = $cols;
    }
    return $salida;
}

function nueva(string $archivo): PDO
{
    $db = new PDO('sqlite:' . $archivo, null, null, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $db->exec('PRAGMA foreign_keys = ON');
    return $db;
}

// ── A · instalación desde cero ───────────────────────────────────────────────
$a = nueva($tmp . '/desde-cero.sqlite');
gg_migrar($a);
$esquemaA = esquema($a);
$versionA = gg_meta($a, 'esquema');

// ── B · base «antigua»: se instala y se la deja en la versión 1, como las que
//        ya estaban en producción antes del pago en línea. Luego se migra.
$b = nueva($tmp . '/migrada.sqlite');
gg_migrar($b);
// Se deshace hasta el estado de la versión 1 para recorrer los escalones de
// verdad, no para simularlos. El índice va primero: SQLite se niega a quitar
// una columna de la que cuelga un índice.
$b->exec('DROP INDEX IF EXISTS pedidos_pago_ref');
foreach (['pago_ref', 'pago_id', 'avisado', 'direccion'] as $col) {
    if (gg_columna_existe($b, 'pedidos', $col)) {
        $b->exec("ALTER TABLE pedidos DROP COLUMN $col");
    }
}
gg_meta_set($b, 'esquema', '1');

gg_migrar_incrementos($b, 1);
$esquemaB = esquema($b);
$versionB = gg_meta($b, 'esquema');

// ── Comparación ──────────────────────────────────────────────────────────────
$fallos = 0;

printf("Versión desde cero: %s   ·   migrada: %s   %s\n", $versionA, $versionB,
    $versionA === $versionB ? 'OK' : 'NO COINCIDEN');
if ($versionA !== $versionB) {
    $fallos++;
}

foreach ($esquemaA as $tabla => $colsA) {
    $colsB = $esquemaB[$tabla] ?? null;
    if ($colsB === null) {
        printf("FALLA  la tabla «%s» no existe en la base migrada\n", $tabla);
        $fallos++;
        continue;
    }
    $faltan = array_diff($colsA, $colsB);
    $sobran = array_diff($colsB, $colsA);
    if ($faltan || $sobran) {
        printf("FALLA  %s\n", $tabla);
        foreach ($faltan as $c) {
            printf("         falta en la migrada: %s\n", $c);
        }
        foreach ($sobran as $c) {
            printf("         sobra en la migrada: %s\n", $c);
        }
        $fallos++;
    }
}

// Y que las columnas del pago estén donde deben, que es lo que falló.
foreach ([['pedidos', 'pago_ref', true], ['pedidos', 'pago_id', true],
          ['pedidos', 'avisado', true], ['pedidos', 'direccion', true],
          ['clientes', 'pago_ref', false], ['clientes', 'pago_id', false]] as [$t, $c, $debe]) {
    $hay = gg_columna_existe($a, $t, $c);
    if ($hay !== $debe) {
        printf("FALLA  %s.%s %s\n", $t, $c, $debe ? 'debería existir y no está' : 'NO debería existir');
        $fallos++;
    }
}

// Limpieza.
foreach (glob($tmp . '/*') ?: [] as $f) {
    @unlink($f);
}
@rmdir($tmp);

echo $fallos === 0
    ? "\nLos dos caminos dejan el mismo esquema.\n"
    : "\n$fallos desajuste(s). NO publiques así.\n";

exit($fallos === 0 ? 0 : 1);

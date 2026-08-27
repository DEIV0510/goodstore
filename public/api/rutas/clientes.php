<?php
declare(strict_types=1);

/**
 * /api/clientes/...
 *
 * La agenda de quién compra. Es la parte más sensible de la API: aquí hay
 * nombres, teléfonos y correos de personas reales. Por eso TODO este archivo
 * exige rol de administrador —un editor no ve ni una sola ficha— y nada de esto
 * se asoma jamás a /api/publico.
 *
 * Dos decisiones marcan el resto del archivo:
 *
 *   · El WhatsApp ES la identidad del cliente, y se guarda como dígitos pelados.
 *     «300 123 4567», «+57 300 123 4567» y «573001234567» son la misma persona;
 *     si cada forma entrara tal cual, el histórico de compras quedaría partido
 *     en tres fichas y ninguna diría la verdad. La columna es UNIQUE.
 *   · Los pedidos, lo gastado y la fecha de la última compra NO se guardan en la
 *     ficha: se calculan sobre la tabla de pedidos cada vez que se piden. Un
 *     contador guardado aparte se desincroniza el día que alguien anula un
 *     pedido, y a partir de ahí la pantalla miente sin que nadie se entere.
 */

// Puerta única, antes de mirar siquiera de qué ruta se trata.
gg_exigir_rol('admin');

$metodo = gg_metodo();
$segundo = $ruta[1] ?? '';
$cuerpo = in_array($metodo, ['POST', 'PATCH', 'PUT'], true) ? gg_cuerpo() : [];

// ─────────────────────────────────────────────────────────────────────────────
// Ayudas propias de esta ruta
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deja el WhatsApp en su forma canónica: solo dígitos.
 *
 * Se valida el largo porque un número con menos de 7 dígitos o más de 15 no
 * existe (E.164 marca el techo en 15): eso es un error de tecleo, y guardarlo
 * significaría una ficha a la que nunca se le podrá escribir.
 */
function gg_wa_normalizar(string $bruto): string
{
    $digitos = preg_replace('/\D+/', '', $bruto) ?? '';
    if (strlen($digitos) < 7 || strlen($digitos) > 15) {
        throw new GgError(
            'Ese número de WhatsApp no parece válido. Escríbelo con indicativo, por ejemplo 573001234567.'
        );
    }
    return $digitos;
}

/**
 * Correo opcional. No se puede usar gg_email() porque esa exige que venga:
 * en un cliente el correo casi nunca se tiene, y obligar a inventarlo sería
 * justo lo contrario de lo que hace falta.
 */
function gg_email_opcional(array $datos, string $clave): ?string
{
    $v = strtolower(gg_texto($datos, $clave, 190));
    if ($v === '') {
        return null;
    }
    if (!filter_var($v, FILTER_VALIDATE_EMAIL)) {
        throw new GgError('Ese correo electrónico no tiene un formato válido.');
    }
    return $v;
}

/**
 * Texto opcional: vacío se guarda como NULL, no como cadena vacía.
 *
 * No se usa «?: null» a propósito. Ese atajo trata como vacío cualquier valor
 * falso, y el texto «0» lo es: una nota que diga solo «0» —o una ciudad
 * escrita así por error— se guardaría como «sin dato» sin avisar. Aquí la
 * única cosa que significa «sin dato» es la cadena vacía.
 */
function gg_cliente_texto_o_null(array $datos, string $clave, int $maximo): ?string
{
    $v = gg_texto($datos, $clave, $maximo);
    return $v === '' ? null : $v;
}

/**
 * Pliega una lista de pedidos en las tres cifras que muestra la ficha.
 *
 * Recibe las filas ya leídas para no volver a consultar: quien la llama suele
 * tenerlas delante.
 */
function gg_resumen_de_pedidos(array $pedidos): array
{
    $resumen = ['n' => 0, 'total' => 0, 'ultimo' => null];

    foreach ($pedidos as $p) {
        $resumen['n']++;

        // Un pedido anulado sigue siendo parte del histórico y cuenta como
        // pedido, pero no es dinero que haya entrado: no suma al total gastado.
        if (($p['estado'] ?? '') !== 'cancelado') {
            $resumen['total'] += (int) ($p['total'] ?? 0);
        }

        // Las fechas son ISO 8601 en UTC y todas del mismo largo, así que
        // compararlas como texto da el mismo orden que compararlas como fechas.
        $creado = (string) ($p['creado'] ?? '');
        if ($creado !== '' && ($resumen['ultimo'] === null || $creado > $resumen['ultimo'])) {
            $resumen['ultimo'] = $creado;
        }
    }
    return $resumen;
}

/** Las mismas tres cifras, para un solo cliente. */
function gg_resumen_cliente(string $clienteId): array
{
    return gg_resumen_de_pedidos(
        gg_filas('SELECT estado, total, creado FROM pedidos WHERE cliente_id = ?', [$clienteId])
    );
}

/**
 * Corta la operación diciendo de quién es ese WhatsApp.
 *
 * Un «ya existe» a secas deja al administrador buscando a ciegas por toda la
 * lista; con el nombre delante, abre la ficha correcta y sigue.
 */
function gg_choque_whatsapp(string $whatsapp): never
{
    $duenio = gg_fila('SELECT nombre FROM clientes WHERE whatsapp = ?', [$whatsapp]);
    $nombre = trim((string) ($duenio['nombre'] ?? ''));

    throw new GgError(
        $nombre !== ''
            ? "El WhatsApp $whatsapp ya está registrado a nombre de $nombre. Abre esa ficha en vez de crear otra."
            : "El WhatsApp $whatsapp ya está registrado en otra ficha.",
        409
    );
}

/**
 * Inserta la ficha traduciendo el choque de la restricción UNIQUE.
 *
 * La comprobación previa con un SELECT puede quedarse corta si dos altas entran
 * a la vez —lee, lee, inserta, inserta—, así que el índice UNIQUE es el único
 * juez fiable. Aquí su error se convierte en un 409 legible en vez de dejar
 * salir el 500 genérico de base de datos.
 */
function gg_insertar_cliente(array $fila): void
{
    try {
        gg_insertar('clientes', $fila);
    } catch (PDOException $e) {
        if (!str_contains($e->getMessage(), 'UNIQUE')) {
            throw $e;
        }
        gg_choque_whatsapp((string) ($fila['whatsapp'] ?? ''));
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/clientes — la lista, con sus totales calculados
// ─────────────────────────────────────────────────────────────────────────────
if ($segundo === '' && $metodo === 'GET') {
    // El id desempata a las fichas creadas en el mismo segundo —cosa habitual
    // cuando se importan varias de golpe—; sin ese desempate el orden entre
    // ellas lo decide la base y cambia entre recargas de la misma pantalla.
    $filas = gg_filas('SELECT * FROM clientes ORDER BY creado DESC, id DESC');

    // UNA consulta agregada para todos los clientes, no una por cliente. Con
    // 300 fichas, la versión ingenua serían 301 consultas y una pantalla que
    // tarda segundos en abrir.
    $resumenes = [];
    foreach (gg_filas(
        'SELECT cliente_id,
                COUNT(*)                                              AS n,
                COALESCE(SUM(CASE WHEN estado <> ? THEN total END), 0) AS total,
                MAX(creado)                                           AS ultimo
           FROM pedidos
          WHERE cliente_id IS NOT NULL
          GROUP BY cliente_id',
        ['cancelado']
    ) as $r) {
        $resumenes[(string) $r['cliente_id']] = [
            'n'      => (int) $r['n'],
            'total'  => (int) $r['total'],
            'ultimo' => $r['ultimo'],
        ];
    }

    // Sin pedidos van ceros, nunca null: la tabla del panel suma estas cifras y
    // un null se convertiría en «NaN» a la vista del administrador.
    $vacio = ['n' => 0, 'total' => 0, 'ultimo' => null];

    gg_responder([
        'clientes' => array_map(
            static fn($f) => gg_salida_cliente($f, $resumenes[$f['id']] ?? $vacio),
            $filas
        ),
    ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/clientes — alta manual
// ─────────────────────────────────────────────────────────────────────────────
if ($segundo === '' && $metodo === 'POST') {
    $nombre   = gg_texto_obligatorio($cuerpo, 'name', 120);
    $whatsapp = gg_wa_normalizar(gg_texto_obligatorio($cuerpo, 'whatsapp', 40));
    $email    = gg_email_opcional($cuerpo, 'email');
    // Cadena vacía y «sin dato» no son lo mismo: la columna guarda NULL, y así
    // la ficha muestra «—» en vez de un hueco que parece un fallo.
    $ciudad   = gg_cliente_texto_o_null($cuerpo, 'city', 120);
    $notas    = gg_cliente_texto_o_null($cuerpo, 'notes', 2000);

    // Aviso temprano y claro. La red de seguridad real está en el UNIQUE.
    if (gg_fila('SELECT id FROM clientes WHERE whatsapp = ?', [$whatsapp])) {
        gg_choque_whatsapp($whatsapp);
    }

    $id = gg_id();
    $ahora = gg_ahora();

    gg_insertar_cliente([
        'id'          => $id,
        'nombre'      => $nombre,
        'whatsapp'    => $whatsapp,
        'email'       => $email,
        'ciudad'      => $ciudad,
        'notas'       => $notas,
        'creado'      => $ahora,
        'actualizado' => $ahora,
    ]);

    gg_auditar('crear', 'clientes', $id, $nombre);

    $fila = gg_fila('SELECT * FROM clientes WHERE id = ?', [$id]);
    // Los ceros no son un supuesto: una ficha que acaba de nacer no tiene
    // pedidos todavía. Van explícitos para que la fila encaje en la tabla sin
    // que el navegador tenga que recargar la lista entera.
    gg_responder(['cliente' => gg_salida_cliente($fila, ['n' => 0, 'total' => 0, 'ultimo' => null])], 201);
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/clientes/buscar — buscar por WhatsApp o crear
//
// Lo usa la pantalla de registrar un pedido: quien atiende ya tiene el número
// en la conversación de WhatsApp, y no debería tener que comprobar a mano si esa
// persona ya está en la agenda. Esta ruta lo resuelve en un solo paso.
// ─────────────────────────────────────────────────────────────────────────────
if ($segundo === 'buscar' && $metodo === 'POST') {
    $whatsapp = gg_wa_normalizar(gg_texto_obligatorio($cuerpo, 'whatsapp', 40));
    $nombre = gg_texto($cuerpo, 'name', 120);

    $fila = gg_fila('SELECT * FROM clientes WHERE whatsapp = ?', [$whatsapp]);
    if ($fila) {
        // A propósito NO se pisa el nombre guardado con el que venga en el
        // formulario del pedido: la ficha es la versión buena, y un «Juan»
        // tecleado con prisa borraría el nombre completo que ya estaba bien.
        gg_responder(['cliente' => gg_salida_cliente($fila, gg_resumen_cliente((string) $fila['id']))]);
    }

    if ($nombre === '') {
        throw new GgError(
            'No hay ninguna ficha con ese WhatsApp. Escribe también el nombre del cliente para crearla.'
        );
    }

    $id = gg_id();
    $ahora = gg_ahora();

    // Se crea con lo mínimo: el resto de datos se completan luego desde la
    // ficha, sin frenar el registro del pedido que hay entre manos.
    gg_insertar_cliente([
        'id'          => $id,
        'nombre'      => $nombre,
        'whatsapp'    => $whatsapp,
        'email'       => null,
        'ciudad'      => null,
        'notas'       => null,
        'creado'      => $ahora,
        'actualizado' => $ahora,
    ]);

    gg_auditar('crear', 'clientes', $id, $nombre, ['origen' => 'registro de pedido']);

    $fila = gg_fila('SELECT * FROM clientes WHERE id = ?', [$id]);
    gg_responder(['cliente' => gg_salida_cliente($fila, ['n' => 0, 'total' => 0, 'ultimo' => null])], 201);
}

// A partir de aquí el segundo segmento solo puede ser el id de una ficha. Viaja
// siempre como parámetro de una consulta preparada, nunca dentro del SQL.
$id = $segundo;

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/clientes/{id} — la ficha con su historial de pedidos
// ─────────────────────────────────────────────────────────────────────────────
if ($id !== '' && $metodo === 'GET') {
    $fila = gg_fila('SELECT * FROM clientes WHERE id = ?', [$id]);
    if (!$fila) {
        throw new GgError('Ese cliente no existe o ya se eliminó.', 404);
    }

    // Mismo orden que en /api/pedidos: el código desempata a los pedidos
    // registrados en el mismo segundo, que si no salen en un orden distinto
    // cada vez que se abre la ficha.
    $pedidos = gg_filas(
        'SELECT * FROM pedidos WHERE cliente_id = ? ORDER BY creado DESC, codigo DESC',
        [$id]
    );

    // Las líneas de todos los pedidos, sin una consulta por pedido. Los «?» los
    // genera el código contando las filas —no viene ni un dato del navegador
    // dentro del SQL— y los identificadores viajan como parámetros.
    //
    // Se pide por tandas porque SQLite limita cuántos parámetros admite una
    // consulta (999 en compilaciones antiguas). Sin las tandas, la ficha de un
    // cliente con muchos pedidos dejaría de abrirse de golpe, y justo la del
    // mejor cliente es la que más se mira.
    //
    // El orden por rowid conserva el orden en que se escribieron las líneas,
    // que es el que muestra la pantalla de pedidos: sin él, los renglones de un
    // mismo pedido aparecen barajados de forma distinta en cada pantalla.
    $lineasPorPedido = [];
    foreach (array_chunk(array_column($pedidos, 'id'), 300) as $tanda) {
        $huecos = implode(', ', array_fill(0, count($tanda), '?'));
        foreach (gg_filas(
            'SELECT * FROM pedido_lineas WHERE pedido_id IN (' . $huecos . ') ORDER BY rowid ASC',
            $tanda
        ) as $l) {
            $lineasPorPedido[(string) $l['pedido_id']][] = $l;
        }
    }

    gg_responder([
        // El resumen sale de los pedidos que ya están en memoria: pedirlos otra
        // vez a la base sería trabajo repetido.
        'cliente' => gg_salida_cliente($fila, gg_resumen_de_pedidos($pedidos)),
        'pedidos' => array_map(
            static fn($p) => gg_salida_pedido($p, $lineasPorPedido[$p['id']] ?? [], $fila),
            $pedidos
        ),
    ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/clientes/{id} — edición parcial
// ─────────────────────────────────────────────────────────────────────────────
if ($id !== '' && $metodo === 'PATCH') {
    $antes = gg_fila('SELECT * FROM clientes WHERE id = ?', [$id]);
    if (!$antes) {
        throw new GgError('Ese cliente no existe o ya se eliminó.', 404);
    }

    // Las columnas que se pueden tocar están escritas AQUÍ, una por una, y no
    // se deducen de lo que traiga el cuerpo: si se copiara el cuerpo tal cual,
    // bastaría con enviar «id» o «creado» para reescribir cosas que no son del
    // formulario. Solo se incluye lo que el navegador mandó de verdad, porque
    // esto es un PATCH: lo que no viene, no se toca.
    $cambios = [];
    if (array_key_exists('name', $cuerpo)) {
        $cambios['nombre'] = gg_texto_obligatorio($cuerpo, 'name', 120);
    }
    if (array_key_exists('whatsapp', $cuerpo)) {
        $cambios['whatsapp'] = gg_wa_normalizar(gg_texto_obligatorio($cuerpo, 'whatsapp', 40));
    }
    if (array_key_exists('email', $cuerpo)) {
        $cambios['email'] = gg_email_opcional($cuerpo, 'email');
    }
    if (array_key_exists('city', $cuerpo)) {
        $cambios['ciudad'] = gg_cliente_texto_o_null($cuerpo, 'city', 120);
    }
    if (array_key_exists('notes', $cuerpo)) {
        $cambios['notas'] = gg_cliente_texto_o_null($cuerpo, 'notes', 2000);
    }

    // Solo se comprueba si el número cambió de verdad: guardar la ficha sin
    // tocar el teléfono chocaría contra sí misma.
    if (isset($cambios['whatsapp']) && $cambios['whatsapp'] !== (string) $antes['whatsapp']) {
        if (gg_fila('SELECT id FROM clientes WHERE whatsapp = ? AND id <> ?', [$cambios['whatsapp'], $id])) {
            gg_choque_whatsapp($cambios['whatsapp']);
        }
    }

    if ($cambios) {
        try {
            gg_actualizar('clientes', $id, $cambios + ['actualizado' => gg_ahora()]);
        } catch (PDOException $e) {
            // Mismo caso que en el alta: dos ediciones simultáneas hacia el
            // mismo número solo las separa el índice UNIQUE.
            if (!str_contains($e->getMessage(), 'UNIQUE')) {
                throw $e;
            }
            // La única columna UNIQUE de la tabla es whatsapp, así que solo
            // puede venir de ahí; aun así se lee con ?? para no depender de
            // esa suposición si mañana aparece otro índice.
            gg_choque_whatsapp((string) ($cambios['whatsapp'] ?? ''));
        }

        // Se registra con el nombre nuevo si lo hubo: buscar en el historial
        // por el nombre viejo no se le ocurre a nadie.
        gg_auditar_cambio('clientes', $id, (string) ($cambios['nombre'] ?? $antes['nombre']), $antes, $cambios);
    }

    // Se relee para devolver la ficha tal como quedó guardada. Si entre medias
    // otro administrador borró este cliente, el UPDATE no tocó ninguna fila y
    // aquí no hay nada que leer: mejor decirlo con un 404 que reventar
    // pasándole null a la función que arma la respuesta.
    $fila = gg_fila('SELECT * FROM clientes WHERE id = ?', [$id]);
    if (!$fila) {
        throw new GgError('Ese cliente no existe o ya se eliminó.', 404);
    }
    gg_responder(['cliente' => gg_salida_cliente($fila, gg_resumen_cliente($id))]);
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/clientes/{id}
// ─────────────────────────────────────────────────────────────────────────────
if ($id !== '' && $metodo === 'DELETE') {
    $fila = gg_fila('SELECT * FROM clientes WHERE id = ?', [$id]);
    if (!$fila) {
        throw new GgError('Ese cliente no existe o ya se eliminó.', 404);
    }

    // Se cuentan antes de borrar, para poder decir en la respuesta qué pasó con
    // ellos: un pedido que desaparece de las ventas sin avisar es un agujero en
    // la contabilidad del negocio.
    $huerfanos = (int) gg_valor('SELECT COUNT(*) FROM pedidos WHERE cliente_id = ?', [$id]);

    // Los pedidos NO se borran. La clave foránea está declarada como
    // ON DELETE SET NULL y el PRAGMA foreign_keys va activado en cada conexión:
    // los pedidos quedan registrados, solo que sin cliente asociado.
    gg_ejecutar('DELETE FROM clientes WHERE id = ?', [$id]);

    gg_auditar('eliminar', 'clientes', $id, (string) $fila['nombre'], [
        'pedidos_sin_cliente' => $huerfanos,
    ]);

    $nombre = (string) $fila['nombre'];
    $mensaje = "Se eliminó la ficha de $nombre.";
    if ($huerfanos === 1) {
        $mensaje .= ' Su pedido no se borró: queda registrado sin cliente asociado.';
    } elseif ($huerfanos > 1) {
        $mensaje .= " Sus $huerfanos pedidos no se borraron: quedan registrados sin cliente asociado.";
    }

    gg_responder([
        'ok'                => true,
        'mensaje'           => $mensaje,
        'pedidosSinCliente' => $huerfanos,
    ]);
}

gg_error('No existe esa dirección en la API.', 404);

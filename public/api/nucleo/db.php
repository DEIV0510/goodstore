<?php
declare(strict_types=1);

/**
 * GOOD GAME · Base de datos
 *
 * SQLite en un archivo del propio hosting. Para una tienda de 318 productos y
 * dos o tres administradores es más que suficiente, y evita tener que crear
 * bases de datos, usuarios y contraseñas en ningún panel: el archivo se crea
 * solo la primera vez que alguien entra.
 *
 * Copia de seguridad = copiar un archivo. Restaurar = devolverlo a su sitio.
 *
 * Si el hosting no tuviera SQLite (raro, viene de serie en PHP), el
 * diagnóstico lo dice claramente en vez de fallar a medias.
 */

function gg_db(): PDO
{
    static $db = null;
    if ($db instanceof PDO) {
        return $db;
    }

    if (!extension_loaded('pdo_sqlite')) {
        throw new RuntimeException(
            'Este servidor no tiene SQLite activado (extensión pdo_sqlite). ' .
            'Actívala en hPanel → Avanzado → Configuración PHP.'
        );
    }

    $archivo = gg_carpeta_datos() . '/goodgame.sqlite';
    $nuevo = !is_file($archivo);

    $db = new PDO('sqlite:' . $archivo, null, null, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        // Sin esto, PDO devuelve todos los números como cadenas y habría que
        // convertirlos a mano en cada consulta.
        PDO::ATTR_STRINGIFY_FETCHES  => false,
    ]);

    // WAL: permite leer mientras se escribe. Sin él, una escritura larga
    // bloquearía a los visitantes que están mirando el catálogo.
    $db->exec('PRAGMA journal_mode = WAL');
    // Espera hasta 5 s si otra petición está escribiendo, en vez de fallar.
    $db->exec('PRAGMA busy_timeout = 5000');
    $db->exec('PRAGMA foreign_keys = ON');

    if ($nuevo) {
        @chmod($archivo, 0640);
    }

    gg_migrar($db);

    return $db;
}

/** Identificador único, con la misma forma que un UUID v4. */
function gg_id(): string
{
    $b = random_bytes(16);
    $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
    $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
}

/** Marca de tiempo en UTC, ISO 8601: lo que espera el navegador. */
function gg_ahora(): string
{
    return gmdate('Y-m-d\TH:i:s\Z');
}

/**
 * ¿Existe ya esa columna? SQLite no tiene «ADD COLUMN IF NOT EXISTS», y volver
 * a añadir una que ya está lanza excepción. Se consulta el esquema en vez de
 * intentarlo y capturar el error, para no confundir un fallo real con uno
 * esperado.
 */
function gg_columna_existe(PDO $db, string $tabla, string $columna): bool
{
    // El nombre de la tabla sale siempre de una constante del código, nunca de
    // la petición: PRAGMA no admite parámetros enlazados.
    foreach ($db->query("PRAGMA table_info($tabla)") as $c) {
        if (($c['name'] ?? '') === $columna) {
            return true;
        }
    }
    return false;
}

/**
 * Crea o actualiza el esquema.
 *
 * Se ejecuta en cada arranque y es idempotente: cada paso comprueba si ya está
 * hecho. Así, publicar una versión nueva del sitio actualiza la base sola, sin
 * que nadie tenga que acordarse de ejecutar nada.
 */
function gg_migrar(PDO $db): void
{
    $db->exec('CREATE TABLE IF NOT EXISTS gg_meta (clave TEXT PRIMARY KEY, valor TEXT NOT NULL)');

    $version = (int) (gg_meta($db, 'esquema') ?? '0');

    // ── Esquema 2 · pagos en línea ──────────────────────────────────────────
    //
    // Va ANTES de la salida temprana a propósito: las bases que ya están en
    // producción se quedaron en la versión 1, y sin esto actualizar el código
    // dejaría la tienda pidiendo columnas que allí no existen.
    if ($version === 1) {
        $db->beginTransaction();
        try {
            // La referencia que viaja a la pasarela y el id que ella devuelve.
            // Se guardan para poder cotejar un pago con su pedido meses después.
            if (!gg_columna_existe($db, 'pedidos', 'pago_ref')) {
                $db->exec('ALTER TABLE pedidos ADD COLUMN pago_ref TEXT');
            }
            if (!gg_columna_existe($db, 'pedidos', 'pago_id')) {
                $db->exec('ALTER TABLE pedidos ADD COLUMN pago_id TEXT');
            }
            // Buscar por referencia es lo que hace la página de retorno cada vez
            // que alguien vuelve de la pasarela.
            $db->exec('CREATE INDEX IF NOT EXISTS pedidos_pago_ref ON pedidos (pago_ref)');

            gg_meta_set($db, 'esquema', '2');
            $db->commit();
        } catch (Throwable $e) {
            $db->rollBack();
            throw $e;
        }
        return;
    }

    if ($version >= 2) {
        return;
    }

    $db->beginTransaction();
    try {
        // ── Administradores ─────────────────────────────────────────────────
        // Solo se guarda el hash de la contraseña, nunca la contraseña.
        $db->exec("
            CREATE TABLE IF NOT EXISTS usuarios (
                id             TEXT PRIMARY KEY,
                email          TEXT NOT NULL UNIQUE COLLATE NOCASE,
                nombre         TEXT NOT NULL DEFAULT '',
                clave_hash     TEXT NOT NULL,
                rol            TEXT NOT NULL DEFAULT 'editor',
                estado         TEXT NOT NULL DEFAULT 'activo',
                codigo_hash    TEXT,
                ultimo_acceso  TEXT,
                creado         TEXT NOT NULL,
                actualizado    TEXT NOT NULL
            )
        ");

        // Intentos fallidos, para frenar la fuerza bruta.
        $db->exec("
            CREATE TABLE IF NOT EXISTS intentos (
                id     INTEGER PRIMARY KEY AUTOINCREMENT,
                ip     TEXT NOT NULL,
                email  TEXT NOT NULL,
                cuando TEXT NOT NULL
            )
        ");
        $db->exec('CREATE INDEX IF NOT EXISTS intentos_cuando ON intentos (cuando)');

        // ── Catálogo ────────────────────────────────────────────────────────
        // Los campos que el negocio aún no confirmó admiten NULL, y la tienda
        // los muestra como "por confirmar" en vez de inventar un valor.
        $db->exec("
            CREATE TABLE IF NOT EXISTS productos (
                id           TEXT PRIMARY KEY,
                slug         TEXT NOT NULL UNIQUE,
                nombre       TEXT NOT NULL,
                plataforma   TEXT NOT NULL,
                categoria    TEXT NOT NULL DEFAULT 'videojuegos',
                genero       TEXT,
                estado_copia TEXT NOT NULL DEFAULT 'consultar',
                region       TEXT,
                precio       INTEGER,
                precio_antes INTEGER,
                stock        INTEGER,
                sku          TEXT,
                imagenes     TEXT NOT NULL DEFAULT '[]',
                imagen_w     INTEGER,
                imagen_h     INTEGER,
                descripcion  TEXT NOT NULL DEFAULT '',
                nota         TEXT,
                etiquetas    TEXT NOT NULL DEFAULT '[]',
                destacado    INTEGER NOT NULL DEFAULT 0,
                oferta       INTEGER NOT NULL DEFAULT 0,
                lanzamiento  INTEGER NOT NULL DEFAULT 0,
                mas_vendido  INTEGER NOT NULL DEFAULT 0,
                estado       TEXT NOT NULL DEFAULT 'publicado',
                orden        INTEGER NOT NULL DEFAULT 0,
                vistas       INTEGER NOT NULL DEFAULT 0,
                creado       TEXT NOT NULL,
                actualizado  TEXT NOT NULL
            )
        ");
        $db->exec('CREATE INDEX IF NOT EXISTS productos_estado ON productos (estado)');
        $db->exec('CREATE INDEX IF NOT EXISTS productos_plataforma ON productos (plataforma)');
        $db->exec('CREATE INDEX IF NOT EXISTS productos_orden ON productos (orden)');

        $db->exec("
            CREATE TABLE IF NOT EXISTS categorias (
                id          TEXT PRIMARY KEY,
                slug        TEXT NOT NULL UNIQUE,
                titulo      TEXT NOT NULL,
                subtitulo   TEXT NOT NULL DEFAULT '',
                descripcion TEXT NOT NULL DEFAULT '',
                enlace      TEXT NOT NULL DEFAULT '/catalogo',
                imagen      TEXT,
                portadas    TEXT NOT NULL DEFAULT '[]',
                orden       INTEGER NOT NULL DEFAULT 0,
                activa      INTEGER NOT NULL DEFAULT 1,
                proximo     INTEGER NOT NULL DEFAULT 0,
                creado      TEXT NOT NULL,
                actualizado TEXT NOT NULL
            )
        ");

        // ── Clientes y pedidos ──────────────────────────────────────────────
        // Solo lo mínimo para atender un pedido: sin documento, sin datos de pago.
        $db->exec("
            CREATE TABLE IF NOT EXISTS clientes (
                id          TEXT PRIMARY KEY,
                nombre      TEXT NOT NULL,
                whatsapp    TEXT NOT NULL UNIQUE,
                email       TEXT,
                ciudad      TEXT,
                notas       TEXT,
                pago_ref    TEXT,
                pago_id     TEXT,
                creado      TEXT NOT NULL,
                actualizado TEXT NOT NULL
            )
        ");

        $db->exec("
            CREATE TABLE IF NOT EXISTS pedidos (
                id          TEXT PRIMARY KEY,
                codigo      TEXT NOT NULL UNIQUE,
                cliente_id  TEXT REFERENCES clientes (id) ON DELETE SET NULL,
                estado      TEXT NOT NULL DEFAULT 'pendiente',
                pago        TEXT,
                canal       TEXT NOT NULL DEFAULT 'whatsapp',
                subtotal    INTEGER NOT NULL DEFAULT 0,
                envio       INTEGER NOT NULL DEFAULT 0,
                total       INTEGER NOT NULL DEFAULT 0,
                notas       TEXT,
                creado      TEXT NOT NULL,
                actualizado TEXT NOT NULL
            )
        ");
        $db->exec('CREATE INDEX IF NOT EXISTS pedidos_creado ON pedidos (creado)');

        // Se guarda copia del nombre y el precio del momento de la venta: si el
        // producto cambia después, el pedido histórico no debe cambiar.
        $db->exec("
            CREATE TABLE IF NOT EXISTS pedido_lineas (
                id           TEXT PRIMARY KEY,
                pedido_id    TEXT NOT NULL REFERENCES pedidos (id) ON DELETE CASCADE,
                producto_id  TEXT,
                nombre       TEXT NOT NULL,
                plataforma   TEXT,
                imagen       TEXT,
                precio_unit  INTEGER NOT NULL DEFAULT 0,
                cantidad     INTEGER NOT NULL DEFAULT 1
            )
        ");
        $db->exec('CREATE INDEX IF NOT EXISTS lineas_pedido ON pedido_lineas (pedido_id)');

        // ── Contenido ───────────────────────────────────────────────────────
        $db->exec("
            CREATE TABLE IF NOT EXISTS banners (
                id          TEXT PRIMARY KEY,
                titulo      TEXT NOT NULL,
                subtitulo   TEXT NOT NULL DEFAULT '',
                imagen      TEXT,
                cta_texto   TEXT NOT NULL DEFAULT '',
                cta_enlace  TEXT NOT NULL DEFAULT '/catalogo',
                desde       TEXT,
                hasta       TEXT,
                activo      INTEGER NOT NULL DEFAULT 1,
                orden       INTEGER NOT NULL DEFAULT 0,
                creado      TEXT NOT NULL,
                actualizado TEXT NOT NULL
            )
        ");

        $db->exec("
            CREATE TABLE IF NOT EXISTS preguntas (
                id          TEXT PRIMARY KEY,
                pregunta    TEXT NOT NULL,
                respuesta   TEXT NOT NULL,
                orden       INTEGER NOT NULL DEFAULT 0,
                activa      INTEGER NOT NULL DEFAULT 1,
                creado      TEXT NOT NULL,
                actualizado TEXT NOT NULL
            )
        ");

        // Clave → JSON. Guarda portada, beneficios, secciones, ajustes y WhatsApp.
        $db->exec("
            CREATE TABLE IF NOT EXISTS opciones (
                grupo       TEXT NOT NULL,
                clave       TEXT NOT NULL,
                valor       TEXT NOT NULL DEFAULT '{}',
                actualizado TEXT NOT NULL,
                PRIMARY KEY (grupo, clave)
            )
        ");

        // ── Auditoría ───────────────────────────────────────────────────────
        // Quién cambió qué. Solo se escribe desde el backend; la API no expone
        // ninguna forma de insertar, editar ni borrar aquí.
        $db->exec("
            CREATE TABLE IF NOT EXISTS auditoria (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                actor_id    TEXT,
                actor       TEXT NOT NULL DEFAULT '',
                accion      TEXT NOT NULL,
                entidad     TEXT NOT NULL,
                entidad_id  TEXT,
                etiqueta    TEXT NOT NULL DEFAULT '',
                detalle     TEXT NOT NULL DEFAULT '{}',
                creado      TEXT NOT NULL
            )
        ");
        $db->exec('CREATE INDEX IF NOT EXISTS auditoria_creado ON auditoria (creado)');
        $db->exec('CREATE INDEX IF NOT EXISTS auditoria_entidad ON auditoria (entidad)');

        gg_meta_set($db, 'esquema', '1');
        gg_meta_set($db, 'creado', gg_ahora());
        $db->commit();
    } catch (Throwable $e) {
        $db->rollBack();
        throw $e;
    }
}

function gg_meta(PDO $db, string $clave): ?string
{
    $s = $db->prepare('SELECT valor FROM gg_meta WHERE clave = ?');
    $s->execute([$clave]);
    $v = $s->fetchColumn();
    return $v === false ? null : (string) $v;
}

function gg_meta_set(PDO $db, string $clave, string $valor): void
{
    $s = $db->prepare(
        'INSERT INTO gg_meta (clave, valor) VALUES (?, ?)
         ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor'
    );
    $s->execute([$clave, $valor]);
}

// ── Ayudas de consulta ───────────────────────────────────────────────────────
// Todas usan consultas preparadas. En este proyecto no se concatena NUNCA un
// valor dentro de una consulta: es la única forma segura de evitar inyección.

function gg_filas(string $sql, array $params = []): array
{
    $s = gg_db()->prepare($sql);
    $s->execute($params);
    return $s->fetchAll();
}

function gg_fila(string $sql, array $params = []): ?array
{
    $s = gg_db()->prepare($sql);
    $s->execute($params);
    $f = $s->fetch();
    return $f === false ? null : $f;
}

function gg_valor(string $sql, array $params = [])
{
    $s = gg_db()->prepare($sql);
    $s->execute($params);
    $v = $s->fetchColumn();
    return $v === false ? null : $v;
}

function gg_ejecutar(string $sql, array $params = []): int
{
    $s = gg_db()->prepare($sql);
    $s->execute($params);
    return $s->rowCount();
}

/**
 * INSERT a partir de un mapa columna => valor.
 * Las columnas vienen siempre de constantes del código, nunca del usuario.
 */
function gg_insertar(string $tabla, array $datos): void
{
    $cols = array_keys($datos);
    $huecos = implode(', ', array_fill(0, count($cols), '?'));
    $sql = 'INSERT INTO ' . $tabla . ' (' . implode(', ', $cols) . ') VALUES (' . $huecos . ')';
    gg_ejecutar($sql, array_values($datos));
}

/** UPDATE parcial: solo toca las columnas presentes en $datos. */
function gg_actualizar(string $tabla, string $id, array $datos): void
{
    if (!$datos) {
        return;
    }
    $sets = implode(', ', array_map(static fn($c) => $c . ' = ?', array_keys($datos)));
    $sql = 'UPDATE ' . $tabla . ' SET ' . $sets . ' WHERE id = ?';
    gg_ejecutar($sql, [...array_values($datos), $id]);
}

/** SQLite guarda los booleanos como 0/1; el JSON debe devolver true/false. */
function gg_bool($v): bool
{
    return (bool) (int) $v;
}

/** Columna TEXT que contiene JSON → array de PHP. */
function gg_json($v, $porOmision = [])
{
    if (!is_string($v) || $v === '') {
        return $porOmision;
    }
    $d = json_decode($v, true);
    return $d === null ? $porOmision : $d;
}

// ─────────────────────────────────────────────────────────────────────────────
// Códigos de pedido
//
// Vive aquí, y no en la ruta de pedidos, porque hay dos sitios que crean
// pedidos: el panel cuando el administrador registra una venta, y el pago en
// línea cuando un cliente empieza a pagar. Los dos necesitan el mismo código.
// ─────────────────────────────────────────────────────────────────────────────

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

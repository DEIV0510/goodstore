<?php
declare(strict_types=1);

/**
 * /api/equipo     → administradores del panel
 * /api/historial  → registro de cambios (solo lectura)
 *
 * Los dos recursos comparten archivo porque son las dos pantallas con las que
 * se vigila lo mismo: quién puede entrar y qué se ha hecho. index.php manda
 * ambos aquí.
 *
 * De aquí NUNCA sale clave_hash ni codigo_hash. Y no es solo que no se
 * muestren: es que ni siquiera se seleccionan en las consultas, para que
 * añadir un campo a una respuesta el día de mañana no pueda filtrarlos por
 * descuido. Un hash filtrado se puede atacar sin conexión, todo el tiempo que
 * haga falta y sin que nadie se entere.
 */

$metodo = gg_metodo();
$cuerpo = in_array($metodo, ['POST', 'PATCH', 'PUT'], true) ? gg_cuerpo() : [];

/**
 * Las únicas columnas de «usuarios» que pueden salir del servidor.
 *
 * Es una constante del código, no un dato de la petición: es la única forma
 * segura de que un nombre de columna acabe dentro de una consulta.
 */
const GG_COLUMNAS_ADMIN = 'id, email, nombre, rol, estado, ultimo_acceso, creado';

/** Estados posibles de una cuenta. Lista cerrada, igual que los roles. */
const GG_ESTADOS_ADMIN = ['activo', 'suspendido'];

// ─────────────────────────────────────────────────────────────────────────────
// Ayudas propias de este archivo
// ─────────────────────────────────────────────────────────────────────────────

/** Ficha de un administrador (sin secretos), o 404 con un mensaje entendible. */
function gg_admin_ficha(string $id): array
{
    $f = gg_fila('SELECT ' . GG_COLUMNAS_ADMIN . ' FROM usuarios WHERE id = ?', [$id]);
    if (!$f) {
        throw new GgError('Esa cuenta de administrador ya no existe.', 404);
    }
    return $f;
}

/**
 * Contraseña que nadie puede acertar, ni siquiera quien la crea.
 *
 * Una cuenta recién dada de alta existe pero todavía no tiene dueño: entra por
 * primera vez con el código de recuperación y elige allí su clave. Mientras
 * tanto necesita un clave_hash válido, y se rellena con ruido que se descarta
 * en el acto.
 *
 * Se codifica en base64 en vez de usar los bytes crudos porque bcrypt corta la
 * entrada en el primer byte cero: un \0 temprano dejaría una contraseña mucho
 * más corta de lo que parece. Bcrypt solo mira los primeros 72 caracteres, y
 * 72 caracteres aleatorios sobran para que esto no se adivine jamás.
 */
function gg_clave_imposible(): string
{
    return password_hash(base64_encode(random_bytes(64)), PASSWORD_DEFAULT);
}

/**
 * Impide que el panel se quede sin ningún super administrador activo.
 *
 * Sin esta comprobación, degradar o suspender a la persona equivocada deja la
 * casa cerrada por dentro y con la llave dentro: nadie podría tocar los
 * ajustes ni dar de alta a nadie, y solo se saldría de ahí con el rescate
 * manual desde el administrador de archivos del hosting.
 *
 * Hoy quien llama a esta ruta ya es un super administrador activo y suele
 * contar él mismo como el que queda. Aun así la regla se comprueba de verdad
 * contra la base: lo que protege es la cuenta, no el razonamiento sobre quién
 * llamó.
 */
function gg_exigir_otro_super_admin(string $excluidoId): void
{
    $quedan = (int) gg_valor(
        "SELECT COUNT(*) FROM usuarios WHERE rol = 'super_admin' AND estado = 'activo' AND id <> ?",
        [$excluidoId]
    );
    if ($quedan < 1) {
        throw new GgError(
            'Tiene que quedar al menos un super administrador activo. ' .
            'Asciende antes a otra persona y luego vuelve a intentarlo.',
            400
        );
    }
}

/**
 * Consulta del historial con el LIMIT enlazado como número.
 *
 * execute() con un array manda todos los parámetros como texto, y el LIMIT de
 * SQLite espera un entero. Se enlaza a mano con PDO::PARAM_INT en vez de meter
 * el número dentro del SQL: aquí no se concatena ningún valor, nunca, ni
 * siquiera uno que ya venga validado.
 */
function gg_historial_filas(string $sql, array $params, int $limite): array
{
    $s = gg_db()->prepare($sql);
    $posicion = 1;
    foreach ($params as $p) {
        $s->bindValue($posicion++, $p, PDO::PARAM_STR);
    }
    $s->bindValue($posicion, $limite, PDO::PARAM_INT);
    $s->execute();
    return $s->fetchAll();
}

// ─────────────────────────────────────────────────────────────────────────────
// /api/historial — solo lectura
// ─────────────────────────────────────────────────────────────────────────────

if ($recurso === 'historial') {
    // No hay POST, PATCH ni DELETE, y es a propósito: un historial que se puede
    // editar no prueba nada, porque el primer movimiento de quien quiera tapar
    // algo sería borrar justo la línea que lo delata.
    if ($metodo !== 'GET') {
        gg_error('El historial no se modifica: solo se consulta.', 405);
    }
    if (($ruta[1] ?? '') !== '') {
        gg_error('No existe esa dirección en la API.', 404);
    }

    // Rol admin y no editor: por el historial pasan pedidos y clientes, y un
    // editor no debe leer por esta puerta lo que no ve por la de delante.
    gg_exigir_rol('admin');

    // Los filtros llegan por la barra de direcciones, así que pasan por los
    // mismos validadores que un cuerpo JSON. Nada entra tal cual.
    $entidad = gg_texto($_GET, 'entidad', 40);
    $limite = gg_entero($_GET, 'limite', 1) ?? 200;
    // Se recorta en vez de responder con error: si el panel pide de más, es
    // preferible devolver 500 líneas que dejar la pantalla en blanco.
    $limite = min($limite, 500);

    $sql = 'SELECT * FROM auditoria';
    $params = [];

    if ($entidad !== '') {
        // «entidad» es el nombre de la columna, y viene fijo del código. Lo que
        // escribió el usuario es solo el valor, y viaja como parámetro. Nunca
        // al revés.
        $sql .= ' WHERE entidad = ?';
        $params[] = $entidad;
    }

    // El desempate por id importa: las marcas de tiempo son de segundo entero y
    // varios cambios seguidos caen en el mismo segundo. Sin él, dos recargas
    // podrían enseñar esas líneas en distinto orden.
    $sql .= ' ORDER BY creado DESC, id DESC LIMIT ?';

    gg_responder([
        'historial' => array_map('gg_salida_auditoria', gg_historial_filas($sql, $params, $limite)),
    ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// /api/equipo — administradores
// ─────────────────────────────────────────────────────────────────────────────

$id = $ruta[1] ?? '';
$sub = $ruta[2] ?? '';

// ── GET /api/equipo — lista ──────────────────────────────────────────────────
if ($id === '' && $metodo === 'GET') {
    gg_exigir_rol('super_admin');

    // Orden por antigüedad: la cuenta principal, la que se creó al instalar,
    // queda siempre arriba.
    $filas = gg_filas('SELECT ' . GG_COLUMNAS_ADMIN . ' FROM usuarios ORDER BY creado ASC');

    gg_responder(['administradores' => array_map('gg_publico_usuario', $filas)]);
}

// ── POST /api/equipo — dar de alta a alguien ─────────────────────────────────
//
// No se le pone contraseña aquí. Se genera un código de recuperación, se
// guarda solo su hash y el código se enseña UNA vez para que el super
// administrador se lo entregue en mano o por WhatsApp. Esa persona entra con
// /api/sesion/recuperar y elige su propia clave.
//
// Se hizo así porque el envío de correo en hosting compartido es poco fiable y
// dependería de otro servicio; y de paso ninguna contraseña ajena pasa nunca
// por las manos de quien da de alta.
if ($id === '' && $metodo === 'POST') {
    gg_exigir_rol('super_admin');

    $email = gg_email($cuerpo, 'email');
    $nombre = gg_texto($cuerpo, 'nombre', 120) ?: explode('@', $email)[0];
    $rol = gg_opcion($cuerpo, 'rol', GG_ROLES, 'editor');

    // La garantía real de que no haya dos correos iguales es el índice UNIQUE
    // de la tabla. Esta consulta está solo para poder responder con un mensaje
    // que se entienda en pantalla en vez de un error de base de datos.
    if (gg_valor('SELECT id FROM usuarios WHERE email = ?', [$email]) !== null) {
        throw new GgError('Ya existe una cuenta con ese correo.', 409);
    }

    $codigo = gg_generar_codigo();
    $ahora = gg_ahora();
    $nuevoId = gg_id();

    try {
        gg_insertar('usuarios', [
            'id'          => $nuevoId,
            'email'       => $email,
            'nombre'      => $nombre,
            // La cuenta existe pero todavía no se puede entrar con contraseña:
            // hasta que su dueño elija una, aquí solo hay ruido.
            'clave_hash'  => gg_clave_imposible(),
            'rol'         => $rol,
            'estado'      => 'activo',
            // Del código solo queda el hash. Ni el super administrador que lo
            // acaba de crear puede volver a leerlo después de esta respuesta.
            'codigo_hash' => password_hash(gg_normalizar_codigo($codigo), PASSWORD_DEFAULT),
            'creado'      => $ahora,
            'actualizado' => $ahora,
        ]);
    } catch (PDOException $e) {
        // Entre la comprobación de arriba y este INSERT cabe otra alta con el
        // mismo correo. El índice UNIQUE la corta igual, pero sin esto lo que
        // se vería en pantalla sería «error de base de datos» en vez del
        // motivo real, que es justo lo que esa comprobación quería evitar.
        if (str_contains($e->getMessage(), 'UNIQUE')) {
            throw new GgError('Ya existe una cuenta con ese correo.', 409);
        }
        throw $e;
    }

    // El rol se anota con la forma { antes, ahora } que espera la interfaz,
    // aunque en un alta solo tenga sentido el «ahora». El código NO se anota:
    // el historial lo puede leer cualquier administrador.
    gg_auditar('crear', 'usuarios', $nuevoId, $email, ['rol' => ['antes' => null, 'ahora' => $rol]]);

    gg_responder([
        'administrador' => gg_publico_usuario(gg_admin_ficha($nuevoId)),
        'codigo'        => $codigo,
    ], 201);
}

// ── PATCH /api/equipo/{id} — cambiar rol y/o estado ──────────────────────────
if ($id !== '' && $sub === '' && $metodo === 'PATCH') {
    $yo = gg_exigir_rol('super_admin');

    // Nadie se toca a sí mismo: ni se degrada por accidente, ni se suspende y
    // se queda fuera con la sesión aún abierta, ni puede «probar» un rol menor
    // y perder la forma de volver.
    if ($id === $yo['id']) {
        throw new GgError(
            'No puedes cambiar tu propio rol ni tu propio estado. ' .
            'Pídeselo a otro super administrador.',
            400
        );
    }

    $antes = gg_admin_ficha($id);

    // PATCH es parcial: lo que no venga en el cuerpo se queda como estaba.
    $rol = gg_opcion($cuerpo, 'rol', GG_ROLES, $antes['rol']);
    $estado = gg_opcion($cuerpo, 'estado', GG_ESTADOS_ADMIN, $antes['estado']);

    // Solo se comprueba si esta cuenta DEJA de ser un super administrador
    // activo; ascender a alguien o cambiar a un editor no pone nada en riesgo.
    $eraMando = $antes['rol'] === 'super_admin' && $antes['estado'] === 'activo';
    $sigueMando = $rol === 'super_admin' && $estado === 'activo';

    // La comprobación y el guardado van dentro de la misma transacción, y no
    // sueltos, porque entre una y otro cabe otra petición. Con dos super
    // administradores y dos degradaciones a la vez, cada una vería que
    // «todavía queda el otro» y las dos pasarían: el panel se quedaría sin
    // ninguno, cerrado por dentro, y solo se saldría de ahí con el rescate
    // manual desde el administrador de archivos del hosting.
    $db = gg_db();
    $db->beginTransaction();
    try {
        if ($eraMando && !$sigueMando) {
            gg_exigir_otro_super_admin($id);
        }

        gg_actualizar('usuarios', $id, [
            'rol'         => $rol,
            'estado'      => $estado,
            'actualizado' => gg_ahora(),
        ]);

        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $e;
    }

    // Solo deja línea en el historial si de verdad cambió algo: guardar
    // «actualizó administrador» cada vez que se abre y se cierra el formulario
    // escondería los cambios que sí importan.
    gg_auditar_cambio(
        'usuarios',
        $id,
        $antes['email'],
        ['rol' => $antes['rol'], 'estado' => $antes['estado']],
        ['rol' => $rol, 'estado' => $estado]
    );

    gg_responder(['administrador' => gg_publico_usuario(gg_admin_ficha($id))]);
}

// ── POST /api/equipo/{id}/codigo — código de recuperación nuevo ──────────────
//
// Para cuando alguien perdió el suyo. El anterior deja de valer en cuanto se
// guarda el hash del nuevo, así que un código apuntado en un papel viejo ya no
// abre nada.
if ($id !== '' && $sub === 'codigo' && $metodo === 'POST') {
    $yo = gg_exigir_rol('super_admin');

    // Sobre uno mismo no: para eso está /api/sesion/codigo, que exige la
    // contraseña. Si esta ruta valiera para la propia cuenta, quien se
    // sentara ante un panel abierto y desatendido se llevaría un código con el
    // que entrar mañana desde su casa.
    if ($id === $yo['id']) {
        throw new GgError(
            'Para tu propio código usa «Mi perfil»: allí se te pide la contraseña antes de generarlo.',
            400
        );
    }

    $ficha = gg_admin_ficha($id);
    $codigo = gg_generar_codigo();

    gg_actualizar('usuarios', $id, [
        'codigo_hash' => password_hash(gg_normalizar_codigo($codigo), PASSWORD_DEFAULT),
        'actualizado' => gg_ahora(),
    ]);

    // En el historial queda que se generó, nunca cuál: el detalle lo puede
    // leer cualquier administrador.
    gg_auditar(
        'actualizar',
        'usuarios',
        $id,
        'Código de recuperación nuevo para ' . $ficha['email']
    );

    // Se enseña una sola vez. A partir de aquí, en la base solo queda su hash.
    gg_responder(['codigo' => $codigo]);
}

// ── DELETE /api/equipo/{id} — borrar una cuenta ──────────────────────────────
if ($id !== '' && $sub === '' && $metodo === 'DELETE') {
    $yo = gg_exigir_rol('super_admin');

    if ($id === $yo['id']) {
        throw new GgError(
            'No puedes borrar tu propia cuenta. Si quieres salir del equipo, ' .
            'pídele a otro super administrador que la borre.',
            400
        );
    }

    $ficha = gg_admin_ficha($id);

    // Misma razón que en el PATCH: comprobar y borrar en la misma transacción.
    // Dos borrados simultáneos, cada uno sobre un super administrador
    // distinto, dejarían el panel sin ninguno si la comprobación fuera aparte.
    $db = gg_db();
    $db->beginTransaction();
    try {
        if ($ficha['rol'] === 'super_admin' && $ficha['estado'] === 'activo') {
            gg_exigir_otro_super_admin($id);
        }

        gg_ejecutar('DELETE FROM usuarios WHERE id = ?', [$id]);

        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $e;
    }

    // El historial NO se toca. Las líneas que firmó esta persona siguen ahí con
    // su nombre: un registro que desaparece al borrar a su autor no sirve para
    // auditar nada, que es justo para lo que existe.
    gg_auditar('eliminar', 'usuarios', $id, $ficha['email'], [
        'rol' => ['antes' => $ficha['rol'], 'ahora' => null],
    ]);

    gg_responder(['ok' => true]);
}

gg_error('No existe esa dirección en la API.', 404);

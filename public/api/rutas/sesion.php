<?php
declare(strict_types=1);

/**
 * /api/sesion/...
 *
 * Acceso al panel. La contraseña nunca se guarda ni se registra: llega, se
 * compara contra un hash bcrypt y se descarta.
 */

$accion = $ruta[1] ?? '';
$metodo = gg_metodo();
$cuerpo = in_array($metodo, ['POST', 'PATCH', 'PUT'], true) ? gg_cuerpo() : [];

// ── GET /api/sesion — quién soy ──────────────────────────────────────────────
if ($accion === '' && $metodo === 'GET') {
    $u = gg_usuario();
    gg_responder(['sesion' => $u ? gg_publico_usuario($u) : null]);
}

// ── POST /api/sesion/instalar — crear la primera cuenta ──────────────────────
//
// Solo funciona mientras NO exista ningún administrador, o cuando se pidió un
// rescate dejando el archivo RESCATE.txt en la carpeta de datos desde el
// administrador de archivos del hosting. Fuera de esos dos casos, responde 403
// siempre: si no, cualquiera podría crearse una cuenta desde internet.
if ($accion === 'instalar' && $metodo === 'POST') {
    $primeraVez = gg_sin_instalar();
    $rescate = !$primeraVez && gg_rescate_pedido();

    if (!$primeraVez && !$rescate) {
        throw new GgError('El panel ya está instalado.', 403);
    }

    $email = gg_email($cuerpo, 'email');
    $nombre = gg_texto($cuerpo, 'nombre', 120) ?: explode('@', $email)[0];
    $clave = (string) ($cuerpo['clave'] ?? '');
    gg_validar_clave($clave);

    $codigo = gg_generar_codigo();
    $ahora = gg_ahora();

    $existente = gg_fila('SELECT id FROM usuarios WHERE email = ?', [$email]);

    if ($existente) {
        // Rescate de una cuenta que ya existía: se le pone contraseña nueva y
        // se le devuelve el rol máximo.
        gg_actualizar('usuarios', $existente['id'], [
            'nombre'      => $nombre,
            'clave_hash'  => password_hash($clave, PASSWORD_DEFAULT),
            'codigo_hash' => password_hash(gg_normalizar_codigo($codigo), PASSWORD_DEFAULT),
            'rol'         => 'super_admin',
            'estado'      => 'activo',
            'actualizado' => $ahora,
        ]);
        $id = $existente['id'];
    } else {
        $id = gg_id();
        gg_insertar('usuarios', [
            'id'          => $id,
            'email'       => $email,
            'nombre'      => $nombre,
            'clave_hash'  => password_hash($clave, PASSWORD_DEFAULT),
            // El primero que se registra manda: sin esto no habría forma de
            // dar de alta a nadie más.
            'rol'         => 'super_admin',
            'estado'      => 'activo',
            'codigo_hash' => password_hash(gg_normalizar_codigo($codigo), PASSWORD_DEFAULT),
            'creado'      => $ahora,
            'actualizado' => $ahora,
        ]);
    }

    if ($rescate) {
        gg_consumir_rescate();
    }

    // Se abre sesión directamente: acabas de demostrar que eres tú.
    gg_iniciar_sesion_php();
    session_regenerate_id(true);
    $_SESSION['usuario'] = $id;
    $_SESSION['visto'] = time();

    $u = gg_fila('SELECT * FROM usuarios WHERE id = ?', [$id]);
    gg_auditar($rescate ? 'actualizar' : 'crear', 'usuarios', $id,
        $rescate ? 'Cuenta principal restablecida' : 'Cuenta principal creada', [], $u);

    gg_responder([
        'sesion' => gg_publico_usuario($u),
        // Se muestra UNA sola vez. A partir de aquí solo queda su hash.
        'codigo' => $codigo,
    ], 201);
}

// ── POST /api/sesion/entrar ──────────────────────────────────────────────────
if ($accion === 'entrar' && $metodo === 'POST') {
    $email = strtolower(gg_texto_obligatorio($cuerpo, 'email', 190));
    $clave = (string) ($cuerpo['clave'] ?? '');
    if ($clave === '') {
        throw new GgError('Escribe tu contraseña.');
    }
    gg_responder(['sesion' => gg_acceder($email, $clave)]);
}

// ── POST /api/sesion/salir ───────────────────────────────────────────────────
if ($accion === 'salir' && $metodo === 'POST') {
    gg_cerrar_sesion();
    gg_responder(['sesion' => null]);
}

// ── POST /api/sesion/recuperar — con el código de recuperación ───────────────
if ($accion === 'recuperar' && $metodo === 'POST') {
    gg_limpiar_intentos();
    $ip = gg_ip();
    $email = strtolower(gg_texto_obligatorio($cuerpo, 'email', 190));

    // El código también se protege del ensayo y error.
    if (gg_intentos_recientes($ip, $email) >= GG_MAX_INTENTOS) {
        throw new GgError(
            'Demasiados intentos. Espera ' . GG_BLOQUEO_MINUTOS . ' minutos e inténtalo de nuevo.',
            429
        );
    }

    $codigo = gg_normalizar_codigo((string) ($cuerpo['codigo'] ?? ''));
    $nueva = (string) ($cuerpo['clave'] ?? '');
    gg_validar_clave($nueva);

    $u = gg_fila('SELECT * FROM usuarios WHERE email = ?', [$email]);
    $hash = $u['codigo_hash'] ?? '$2y$12$s0000000000000000000000000000000000000000000000000000';

    if (!$u || !$u['codigo_hash'] || !password_verify($codigo, $hash)) {
        gg_anotar_intento($ip, $email);
        throw new GgError('El correo o el código de recuperación no son correctos.', 401);
    }

    // El código se consume: uno usado no vuelve a servir. Se entrega otro.
    $nuevoCodigo = gg_generar_codigo();
    gg_actualizar('usuarios', $u['id'], [
        'clave_hash'  => password_hash($nueva, PASSWORD_DEFAULT),
        'codigo_hash' => password_hash(gg_normalizar_codigo($nuevoCodigo), PASSWORD_DEFAULT),
        'actualizado' => gg_ahora(),
    ]);
    gg_olvidar_intentos($ip, $email);

    gg_iniciar_sesion_php();
    session_regenerate_id(true);
    $_SESSION['usuario'] = $u['id'];
    $_SESSION['visto'] = time();

    gg_auditar('actualizar', 'usuarios', $u['id'], 'Contraseña restablecida con el código', [], $u);

    $u = gg_fila('SELECT * FROM usuarios WHERE id = ?', [$u['id']]);
    gg_responder(['sesion' => gg_publico_usuario($u), 'codigo' => $nuevoCodigo]);
}

// ── POST /api/sesion/clave — cambiar la propia contraseña ────────────────────
if ($accion === 'clave' && $metodo === 'POST') {
    $u = gg_exigir_sesion();
    $actual = (string) ($cuerpo['actual'] ?? '');
    $nueva = (string) ($cuerpo['nueva'] ?? '');

    $fila = gg_fila('SELECT * FROM usuarios WHERE id = ?', [$u['id']]);
    // Se pide la actual aunque haya sesión: si alguien se sienta ante un
    // equipo desatendido, no debe poder cambiar la contraseña y quedarse con
    // la cuenta.
    if (!$fila || !password_verify($actual, $fila['clave_hash'])) {
        throw new GgError('La contraseña actual no es correcta.', 401);
    }
    gg_validar_clave($nueva);

    gg_actualizar('usuarios', $u['id'], [
        'clave_hash'  => password_hash($nueva, PASSWORD_DEFAULT),
        'actualizado' => gg_ahora(),
    ]);
    session_regenerate_id(true);
    gg_auditar('actualizar', 'usuarios', $u['id'], 'Cambió su contraseña');
    gg_responder(['ok' => true]);
}

// ── POST /api/sesion/codigo — generar un código nuevo ────────────────────────
if ($accion === 'codigo' && $metodo === 'POST') {
    $u = gg_exigir_sesion();
    $clave = (string) ($cuerpo['clave'] ?? '');

    $fila = gg_fila('SELECT * FROM usuarios WHERE id = ?', [$u['id']]);
    if (!$fila || !password_verify($clave, $fila['clave_hash'])) {
        throw new GgError('La contraseña no es correcta.', 401);
    }

    $codigo = gg_generar_codigo();
    gg_actualizar('usuarios', $u['id'], [
        'codigo_hash' => password_hash(gg_normalizar_codigo($codigo), PASSWORD_DEFAULT),
        'actualizado' => gg_ahora(),
    ]);
    gg_auditar('actualizar', 'usuarios', $u['id'], 'Generó un código de recuperación nuevo');
    gg_responder(['codigo' => $codigo]);
}

// ── PATCH /api/sesion/perfil — cambiar el propio nombre ──────────────────────
if ($accion === 'perfil' && $metodo === 'PATCH') {
    $u = gg_exigir_sesion();
    $nombre = gg_texto_obligatorio($cuerpo, 'nombre', 120);

    // A propósito NO se admite cambiar aquí el rol ni el estado: si se pudiera,
    // un editor se ascendería a super administrador desde la consola del
    // navegador. Eso solo lo hace /api/equipo, y solo un super administrador.
    gg_actualizar('usuarios', $u['id'], ['nombre' => $nombre, 'actualizado' => gg_ahora()]);
    gg_auditar_cambio('usuarios', $u['id'], $u['email'], ['nombre' => $u['nombre']], ['nombre' => $nombre]);

    $fila = gg_fila('SELECT * FROM usuarios WHERE id = ?', [$u['id']]);
    gg_responder(['sesion' => gg_publico_usuario($fila)]);
}

gg_error('No existe esa dirección en la API.', 404);

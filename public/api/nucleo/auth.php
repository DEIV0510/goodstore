<?php
declare(strict_types=1);

/**
 * GOOD GAME · Sesión y permisos
 *
 * Aquí está la seguridad real del panel. Puntos que importan:
 *
 *   · La contraseña NUNCA se guarda. Se guarda su hash bcrypt, que no se puede
 *     revertir. Ni yo ni nadie con acceso al archivo puede leerla.
 *   · La cookie de sesión es HttpOnly (JavaScript no la puede leer, así que un
 *     XSS no la roba), SameSite=Strict (otra web no la puede usar) y Secure
 *     cuando hay HTTPS.
 *   · Cada petición que modifica algo comprueba el rol EN EL SERVIDOR. Ocultar
 *     un botón no protege nada: cualquiera puede lanzar la petición a mano.
 *   · Los intentos fallidos se cuentan y bloquean temporalmente, para que no se
 *     pueda probar contraseñas a lo bruto.
 */

function gg_iniciar_sesion_php(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    session_name('gg_sesion');
    session_set_cookie_params([
        'lifetime' => 0,               // dura lo que dure el navegador abierto
        'path'     => '/',
        'httponly' => true,            // JavaScript no la puede leer
        'secure'   => gg_es_https(),
        // Strict: el navegador no envía esta cookie en peticiones que vengan de
        // otro sitio. Es la primera barrera contra CSRF.
        'samesite' => 'Strict',
    ]);
    session_start();

    // Caducidad por inactividad.
    $limite = GG_SESION_MINUTOS * 60;
    if (isset($_SESSION['visto']) && time() - (int) $_SESSION['visto'] > $limite) {
        gg_cerrar_sesion();
        session_start();
    }
    $_SESSION['visto'] = time();
}

/**
 * Segunda barrera contra CSRF.
 *
 * Un formulario de otra web puede provocar un POST, pero NO puede añadir una
 * cabecera propia sin pasar antes por una comprobación CORS que este servidor
 * no concede. Exigirla corta ese ataque aunque SameSite fallara.
 */
function gg_exigir_origen(): void
{
    if (in_array(gg_metodo(), ['GET', 'HEAD', 'OPTIONS'], true)) {
        return;
    }
    if (($_SERVER['HTTP_X_GG'] ?? '') !== '1') {
        throw new GgError('Petición no permitida.', 403);
    }
}

function gg_cerrar_sesion(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        return;
    }
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires'  => time() - 42000,
            'path'     => $p['path'],
            'domain'   => $p['domain'],
            'secure'   => $p['secure'],
            'httponly' => $p['httponly'],
            'samesite' => $p['samesite'] ?? 'Strict',
        ]);
    }
    session_destroy();
}

/** Usuario de la sesión actual, o null. */
function gg_usuario(): ?array
{
    static $usuario = false;
    if ($usuario !== false) {
        return $usuario;
    }

    gg_iniciar_sesion_php();
    $id = $_SESSION['usuario'] ?? null;
    if (!is_string($id) || $id === '') {
        return $usuario = null;
    }

    $u = gg_fila(
        'SELECT id, email, nombre, rol, estado, ultimo_acceso, creado FROM usuarios WHERE id = ?',
        [$id]
    );

    // Si la cuenta se suspendió o borró mientras la sesión seguía abierta, la
    // sesión deja de valer inmediatamente.
    if (!$u || $u['estado'] !== 'activo') {
        gg_cerrar_sesion();
        return $usuario = null;
    }
    return $usuario = $u;
}

function gg_exigir_sesion(): array
{
    $u = gg_usuario();
    if (!$u) {
        throw new GgError('Necesitas iniciar sesión.', 401);
    }
    return $u;
}

/** ¿El rol del usuario llega al nivel pedido? */
function gg_rol_alcanza(string $rol, string $minimo): bool
{
    $a = array_search($rol, GG_ROLES, true);
    $b = array_search($minimo, GG_ROLES, true);
    return $a !== false && $b !== false && $a >= $b;
}

/**
 * Puerta de cada endpoint que modifica algo.
 *
 *   editor      → catálogo y contenido; NO borra, NO ve pedidos ni clientes
 *   admin       → todo lo anterior, más borrar, pedidos y clientes
 *   super_admin → todo, incluidos ajustes y administradores
 */
function gg_exigir_rol(string $minimo): array
{
    $u = gg_exigir_sesion();
    if (!gg_rol_alcanza($u['rol'], $minimo)) {
        throw new GgError('Tu rol no tiene permiso para hacer esto.', 403);
    }
    return $u;
}

// ── Control de intentos ──────────────────────────────────────────────────────

function gg_limpiar_intentos(): void
{
    gg_ejecutar('DELETE FROM intentos WHERE cuando < ?', [
        gmdate('Y-m-d\TH:i:s\Z', time() - GG_BLOQUEO_MINUTOS * 60),
    ]);
}

function gg_intentos_recientes(string $ip, string $email): int
{
    $desde = gmdate('Y-m-d\TH:i:s\Z', time() - GG_BLOQUEO_MINUTOS * 60);
    return (int) gg_valor(
        'SELECT COUNT(*) FROM intentos WHERE cuando >= ? AND (ip = ? OR email = ?)',
        [$desde, $ip, $email]
    );
}

function gg_anotar_intento(string $ip, string $email): void
{
    gg_insertar('intentos', ['ip' => $ip, 'email' => $email, 'cuando' => gg_ahora()]);
}

function gg_olvidar_intentos(string $ip, string $email): void
{
    gg_ejecutar('DELETE FROM intentos WHERE ip = ? OR email = ?', [$ip, $email]);
}

/**
 * Comprueba las credenciales y abre la sesión.
 *
 * El mensaje de error es el mismo tanto si el correo no existe como si la
 * contraseña falla: decir cuál de las dos cosas falló le regala a un atacante
 * la lista de correos válidos.
 */
function gg_acceder(string $email, string $clave): array
{
    gg_limpiar_intentos();
    $ip = gg_ip();

    if (gg_intentos_recientes($ip, $email) >= GG_MAX_INTENTOS) {
        throw new GgError(
            'Demasiados intentos fallidos. Espera ' . GG_BLOQUEO_MINUTOS . ' minutos e inténtalo de nuevo.',
            429
        );
    }

    $u = gg_fila('SELECT * FROM usuarios WHERE email = ?', [$email]);

    // Se verifica siempre contra un hash, exista el usuario o no, para que el
    // tiempo de respuesta no delate si el correo está registrado.
    $hash = $u['clave_hash'] ?? '$2y$12$s0000000000000000000000000000000000000000000000000000';
    $correcta = password_verify($clave, $hash);

    if (!$u || !$correcta) {
        gg_anotar_intento($ip, $email);
        throw new GgError('Correo o contraseña incorrectos.', 401);
    }
    if ($u['estado'] !== 'activo') {
        throw new GgError('Tu cuenta está suspendida. Contacta a un super administrador.', 403);
    }

    // Si el coste de bcrypt subió desde que se creó la cuenta, se rehashea.
    if (password_needs_rehash($u['clave_hash'], PASSWORD_DEFAULT)) {
        gg_actualizar('usuarios', $u['id'], [
            'clave_hash'  => password_hash($clave, PASSWORD_DEFAULT),
            'actualizado' => gg_ahora(),
        ]);
    }

    gg_olvidar_intentos($ip, $email);

    gg_iniciar_sesion_php();
    // Contra la fijación de sesión: se cambia el identificador al entrar, así
    // una sesión preparada de antemano por un atacante deja de servir.
    session_regenerate_id(true);
    $_SESSION['usuario'] = $u['id'];
    $_SESSION['visto'] = time();

    gg_actualizar('usuarios', $u['id'], ['ultimo_acceso' => gg_ahora()]);
    gg_auditar('acceso', 'sesion', $u['id'], 'Inició sesión', [], $u);

    return gg_publico_usuario($u);
}

/** Forma en la que un usuario sale al navegador: sin hashes ni códigos. */
function gg_publico_usuario(array $u): array
{
    return [
        'id'          => $u['id'],
        'email'       => $u['email'],
        'name'        => $u['nombre'],
        'role'        => $u['rol'],
        'status'      => $u['estado'],
        'lastLoginAt' => $u['ultimo_acceso'] ?? null,
        'createdAt'   => $u['creado'],
    ];
}

/** Reglas mínimas de contraseña. */
function gg_validar_clave(string $clave): void
{
    if (mb_strlen($clave) < 8) {
        throw new GgError('La contraseña debe tener al menos 8 caracteres.');
    }
    if (mb_strlen($clave) > 200) {
        throw new GgError('La contraseña es demasiado larga.');
    }
    // Contraseñas obvias: no es una lista exhaustiva, pero corta las peores.
    $obvias = ['12345678', 'password', 'contrasena', 'contraseña', 'admin123', 'goodgame'];
    if (in_array(mb_strtolower($clave), $obvias, true)) {
        throw new GgError('Esa contraseña es demasiado fácil de adivinar. Elige otra.');
    }
}

/**
 * Código de recuperación: se enseña UNA vez al crear la cuenta y se guarda
 * solo su hash. Sustituye al correo de recuperación, porque el envío de correo
 * en hosting compartido es poco fiable y dependería de otro servicio.
 */
function gg_generar_codigo(): string
{
    // Sin caracteres que se confundan al copiarlos a mano (0/O, 1/I/l).
    $alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    $grupos = [];
    for ($g = 0; $g < 4; $g++) {
        $t = '';
        for ($i = 0; $i < 5; $i++) {
            $t .= $alfabeto[random_int(0, strlen($alfabeto) - 1)];
        }
        $grupos[] = $t;
    }
    return implode('-', $grupos);
}

function gg_normalizar_codigo(string $codigo): string
{
    return strtoupper(preg_replace('/[^A-Z0-9]/i', '', $codigo) ?? '');
}

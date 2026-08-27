<?php
declare(strict_types=1);

/**
 * /api/medios
 *
 * Subida y borrado de imágenes. Es la ruta más delicada de toda la API: un
 * archivo admitido sin comprobar es, literalmente, un desconocido dejando algo
 * suyo dentro del servidor. Si además ese algo acaba llamándose «.php» y en una
 * carpeta que Apache sirve, deja de ser una tienda y pasa a ser el servidor de
 * otro.
 *
 * Por eso aquí no se cree NADA de lo que dice el navegador:
 *
 *   · El tipo del archivo sale de su CONTENIDO (finfo), nunca de $_FILES['type']
 *     ni de la extensión del nombre: los dos los escribe el navegador y se
 *     falsifican cambiando dos letras.
 *   · El nombre lo inventa el servidor. El original ni se usa ni se guarda, ni
 *     siquiera «saneado»: un punto de más y aparece «foto.php.webp», que algunos
 *     servidores mal configurados sirven como PHP.
 *   · Solo entran los cuatro formatos de GG_IMAGEN_TIPOS. SVG queda fuera a
 *     propósito, aunque sea una imagen: un SVG es XML y puede traer <script>
 *     dentro, así que subirlo equivale a permitir XSS con dominio propio.
 *   · Lo guardado nunca es ejecutable (0644), y la carpeta /medios lleva además
 *     su propio .htaccess apagando el motor de PHP (ver nucleo/config.php).
 *   · Al borrar, la ruta se resuelve con realpath y se comprueba que el
 *     resultado sigue dentro de /medios. Sin esa comprobación, una url con «..»
 *     borraría archivos de cualquier punto del servidor.
 */

$accion = $ruta[1] ?? '';
$metodo = gg_metodo();

// ─────────────────────────────────────────────────────────────────────────────
// Ayudas propias de esta ruta
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Carpetas admitidas dentro del depósito.
 *
 * Lista cerrada, escrita en el código: el navegador elige entre estas y nada
 * más. En cuanto un trozo de ruta lo decidiera el usuario, «carpeta» sería la
 * puerta abierta para escribir donde quisiera.
 */
function gg_carpetas_medios(): array
{
    return ['productos', 'categorias', 'banners', 'marca'];
}

/**
 * Traduce el código que PHP deja en $_FILES[...]['error'] a un mensaje en
 * español y al HTTP que le corresponde. Devuelve [mensaje, http].
 *
 * Se traducen todos, incluidos los que dependen de la configuración del
 * hosting: cuando la subida falla por el php.ini, quien está delante del panel
 * necesita leer QUÉ tocar, no un número suelto.
 */
function gg_error_subida(int $codigo): array
{
    return match ($codigo) {
        UPLOAD_ERR_INI_SIZE => [
            'La imagen pesa más de lo que admite este servidor (' .
                (ini_get('upload_max_filesize') ?: 'upload_max_filesize') .
                '). Redúcela, o sube ese límite en hPanel → Avanzado → Configuración PHP.',
            413,
        ],
        UPLOAD_ERR_FORM_SIZE => [
            'La imagen supera el tamaño máximo que pedía el formulario.',
            413,
        ],
        UPLOAD_ERR_PARTIAL => [
            'La imagen llegó solo a medias. Comprueba la conexión y vuelve a intentarlo.',
            400,
        ],
        UPLOAD_ERR_NO_FILE => [
            'No seleccionaste ninguna imagen.',
            400,
        ],
        UPLOAD_ERR_NO_TMP_DIR => [
            'El servidor no tiene carpeta temporal donde recibir archivos (upload_tmp_dir). ' .
                'Esto lo arregla el hosting, no el panel.',
            500,
        ],
        UPLOAD_ERR_CANT_WRITE => [
            'El servidor no pudo escribir la imagen en el disco. Suele ser falta de ' .
                'espacio o de permisos en la cuenta del hosting.',
            500,
        ],
        UPLOAD_ERR_EXTENSION => [
            'Una extensión de PHP del servidor detuvo la subida.',
            500,
        ],
        default => [
            'No se pudo subir la imagen (código ' . $codigo . ').',
            400,
        ],
    };
}

/** Extensiones que se aceptan al borrar. */
function gg_extensiones_medios(): array
{
    $ext = array_values(GG_IMAGEN_TIPOS);
    // Lo que sube esta ruta siempre acaba en «.jpg», pero una imagen colocada a
    // mano desde el administrador de archivos del hosting puede llamarse
    // «.jpeg» y también debe poder borrarse desde el panel.
    $ext[] = 'jpeg';
    return $ext;
}

/**
 * Convierte la url pública de una imagen en su ruta relativa dentro de
 * /medios, o null si es una url que este endpoint no debe tocar.
 *
 * Aquí empieza la defensa contra la travesía de rutas. Se exige, por orden:
 *   · que no traiga bytes nulos (cortarían la cadena dentro de las funciones de
 *     archivo, que por debajo son C, y dejarían pasar «x.webp\0.php»);
 *   · que empiece por /medios/ y tenga exactamente dos tramos: carpeta conocida
 *     y nombre de archivo;
 *   · que el nombre sea llano, sin barras ni «..» ni empezar por punto;
 *   · que termine en una extensión de imagen conocida.
 *
 * Esa última condición es la que impide borrar el .htaccess que apaga PHP
 * dentro de /medios, que es justo lo primero que quitaría alguien que quisiera
 * dejar la carpeta preparada para ejecutar código.
 *
 * Esto es solo el primer filtro: quien decide de verdad es el realpath de más
 * abajo.
 */
function gg_ruta_medios_desde_url(string $url): ?string
{
    if (str_contains($url, "\0")) {
        return null;
    }

    // La parte de consulta («?v=2») no forma parte del nombre del archivo.
    $camino = parse_url($url, PHP_URL_PATH);
    if (!is_string($camino) || $camino === '') {
        return null;
    }

    // Se decodifica ANTES de buscar «..»: si se mirara primero, un «%2e%2e»
    // pasaría el filtro y se convertiría en «..» al usarlo. La barra invertida
    // se descarta porque en Windows también separa carpetas.
    $camino = rawurldecode($camino);
    if (str_contains($camino, "\0") || str_contains($camino, '..') || str_contains($camino, '\\')) {
        return null;
    }
    if (!str_starts_with($camino, '/medios/')) {
        return null;
    }

    $tramos = explode('/', substr($camino, strlen('/medios/')));
    if (count($tramos) !== 2) {
        return null;
    }
    [$carpeta, $nombre] = $tramos;

    if (!in_array($carpeta, gg_carpetas_medios(), true)) {
        return null;
    }
    // Nombre llano: empieza por letra o número (así ningún archivo oculto entra)
    // y sigue con letras, números, punto, guion o guion bajo.
    //
    // El modificador D no sobra: sin él, «$» en PCRE también da por bueno un
    // salto de línea al final, y gg_texto() no limpia el \n (solo lo recorta si
    // va justo al borde). Con D, «$» significa final de verdad de la cadena.
    if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/D', $nombre)) {
        return null;
    }
    $extension = strtolower((string) pathinfo($nombre, PATHINFO_EXTENSION));
    if (!in_array($extension, gg_extensiones_medios(), true)) {
        return null;
    }

    return $carpeta . '/' . $nombre;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/medios — subir una imagen
// ─────────────────────────────────────────────────────────────────────────────
if ($accion === '' && $metodo === 'POST') {
    // Antes de mirar el archivo siquiera: quien no pueda editar el catálogo no
    // deja archivos en el servidor.
    $usuario = gg_exigir_rol('editor');

    // El cuerpo es multipart/form-data, así que aquí NO sirve gg_cuerpo(): PHP
    // ya desmontó la petición en $_POST y $_FILES antes de llegar hasta aquí.
    // La carpeta pasa igualmente por el validador de lista cerrada.
    $carpeta = gg_opcion($_POST, 'carpeta', gg_carpetas_medios(), 'productos') ?? 'productos';

    $archivo = $_FILES['archivo'] ?? null;
    $esMultipart = str_contains(
        strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? '')),
        'multipart/form-data'
    );

    if (!is_array($archivo)) {
        // Cuando el envío pasa de post_max_size, PHP tira el cuerpo ENTERO:
        // llegan $_POST y $_FILES vacíos y no hay siquiera un código de error
        // que mirar. Sin este aviso el panel diría «no seleccionaste ninguna
        // imagen» y mandaría a buscar el problema justo al lado contrario.
        if ($esMultipart && !$_POST && (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
            throw new GgError(
                'La imagen es demasiado grande para este servidor (el límite de la petición ' .
                'completa es ' . (ini_get('post_max_size') ?: 'post_max_size') . '). ' .
                'Redúcela, o sube ese límite en hPanel → Avanzado → Configuración PHP.',
                413
            );
        }
        if (!$esMultipart) {
            throw new GgError(
                'La imagen debe enviarse como multipart/form-data en el campo «archivo».',
                400
            );
        }
        throw new GgError('No llegó ninguna imagen en el campo «archivo».', 400);
    }
    // Si el formulario mandara «archivo[]» en vez de «archivo», PHP devolvería
    // un array dentro de cada clave y todas las comprobaciones de abajo
    // recibirían un array donde esperan texto. Se corta aquí.
    if (is_array($archivo['error'] ?? null) || is_array($archivo['tmp_name'] ?? null)) {
        throw new GgError('Sube las imágenes de una en una.', 400);
    }

    // ── 1 · Qué dice PHP de la subida ────────────────────────────────────────
    $codigo = (int) ($archivo['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($codigo !== UPLOAD_ERR_OK) {
        [$mensaje, $http] = gg_error_subida($codigo);
        throw new GgError($mensaje, $http);
    }

    $temporal = (string) ($archivo['tmp_name'] ?? '');

    // ── 2 · ¿Ese temporal lo subió de verdad esta petición? ──────────────────
    // Si es false, alguien está intentando que leamos un archivo del servidor
    // que él no subió: la base de datos, la configuración, /etc/passwd. Con
    // is_uploaded_file solo pasan los temporales que creó PHP para esta
    // petición concreta.
    if ($temporal === '' || !is_uploaded_file($temporal)) {
        throw new GgError('El archivo recibido no es una subida válida.', 400);
    }

    // ── 3 · Tamaño ──────────────────────────────────────────────────────────
    // Se mide el archivo en disco, no el campo 'size' del formulario: ese lo
    // rellena el navegador y puede decir lo que le convenga.
    $bytes = (int) (@filesize($temporal) ?: 0);
    if ($bytes <= 0) {
        throw new GgError('La imagen llegó vacía.', 400);
    }
    if ($bytes > GG_IMAGEN_MAX_BYTES) {
        throw new GgError(
            'La imagen pesa ' . number_format($bytes / 1048576, 1) . ' MB y el máximo son ' .
            number_format(GG_IMAGEN_MAX_BYTES / 1048576, 0) . ' MB.',
            413
        );
    }

    // ── 4 · Tipo real, leído del contenido ──────────────────────────────────
    if (!function_exists('finfo_open')) {
        // Se falla cerrado a propósito: sin fileinfo no hay forma fiable de
        // saber qué es el archivo, y aceptar a ciegas es exactamente el agujero
        // que esta ruta existe para tapar.
        throw new GgError(
            'Este servidor no tiene activada la extensión fileinfo, y sin ella no se ' .
            'puede comprobar qué contiene de verdad el archivo. Actívala en hPanel → ' .
            'Avanzado → Configuración PHP.',
            500
        );
    }
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    if ($finfo === false) {
        // Mismo criterio que arriba: si la comprobación no se puede hacer, no se
        // guarda nada. Pero esto es un fallo del servidor, no del archivo, así
        // que va con 500 y con su propio mensaje: decirle «esa imagen no es
        // válida» a quien subió una foto perfecta la mandaría a cambiar el
        // archivo una y otra vez sin que nada mejore.
        throw new GgError(
            'Este servidor no pudo comprobar qué contiene el archivo. Vuelve a intentarlo; ' .
            'si sigue igual, revisa la extensión fileinfo en hPanel → Avanzado → ' .
            'Configuración PHP.',
            500
        );
    }
    $mime = strtolower((string) finfo_file($finfo, $temporal));
    finfo_close($finfo);

    // ── 5 · ¿Es uno de los formatos admitidos? ──────────────────────────────
    // array_key_exists y no isset: PHP no admite isset() sobre el índice de una
    // constante, y aquí la lista de tipos es precisamente una constante.
    if ($mime === '' || !array_key_exists($mime, GG_IMAGEN_TIPOS)) {
        throw new GgError(
            'Ese archivo no es una imagen admitida. Usa WebP, PNG, JPG o AVIF.',
            415
        );
    }
    // La extensión sale del mime comprobado, nunca del nombre que llegó.
    $extension = GG_IMAGEN_TIPOS[$mime];

    // ── 6 · Dimensiones ─────────────────────────────────────────────────────
    $ancho = null;
    $alto = null;
    if (function_exists('getimagesize')) {
        // La arroba es necesaria: ante un formato que no reconoce, getimagesize
        // además de devolver false suelta un aviso, y un aviso impreso rompería
        // el JSON de la respuesta.
        $medida = @getimagesize($temporal);

        if (is_array($medida) && (int) ($medida[0] ?? 0) > 0 && (int) ($medida[1] ?? 0) > 0) {
            $ancho = (int) $medida[0];
            $alto = (int) $medida[1];

            // Segunda opinión sobre el tipo: si el lector de imágenes ve una
            // cosa y finfo vio otra, el archivo es un híbrido raro (una imagen
            // válida con otra cosa pegada) y no se guarda.
            $mimeMedido = strtolower((string) ($medida['mime'] ?? ''));
            if ($mimeMedido !== '' && $mimeMedido !== $mime) {
                throw new GgError('El contenido de la imagen no coincide con su formato.', 415);
            }

            // Tope de lado. Una imagen de 40.000 × 40.000 px puede pesar cuatro
            // kilobytes comprimida y reventar la memoria de PHP en cuanto algo
            // intente abrirla: es una bomba de descompresión, no una foto.
            if ($ancho > 12000 || $alto > 12000) {
                throw new GgError(
                    'La imagen es demasiado grande: el máximo son 12.000 píxeles por lado.',
                    413
                );
            }
        } elseif ($mime !== 'image/avif') {
            // AVIF es la única excepción tolerada: getimagesize solo lo
            // reconoce en versiones recientes de PHP, así que no poder leerlo
            // no significa que el archivo esté mal; simplemente se queda sin
            // dimensiones. En los demás formatos, que el lector de imágenes no
            // sepa abrirlo sí delata que eso no es la imagen que dice ser.
            throw new GgError('El archivo parece una imagen dañada o falsificada.', 415);
        }
    }

    // ── 7 · Nombre nuevo, puesto por el servidor ────────────────────────────
    // $archivo['name'] no se usa en ningún momento, ni siquiera limpiándolo:
    // 8 bytes al azar en hexadecimal no chocan en la práctica, no revelan nada
    // del equipo de quien subió la foto y no pueden contener sorpresas.
    $destinoCarpeta = gg_carpeta_medios() . '/' . $carpeta;
    if (!gg_asegurar_carpeta($destinoCarpeta)) {
        throw new GgError(
            'No se pudo crear la carpeta de imágenes. Revisa los permisos de escritura del hosting.',
            500
        );
    }

    $nombre = '';
    for ($intento = 0; $intento < 5; $intento++) {
        $candidato = bin2hex(random_bytes(8)) . '.' . $extension;
        if (!file_exists($destinoCarpeta . '/' . $candidato)) {
            $nombre = $candidato;
            break;
        }
    }
    if ($nombre === '') {
        throw new GgError('No se pudo generar un nombre libre para la imagen. Vuelve a intentarlo.', 500);
    }

    // ── 8 · Guardar ─────────────────────────────────────────────────────────
    $destino = $destinoCarpeta . '/' . $nombre;
    // move_uploaded_file, y no rename ni copy: vuelve a comprobar por su cuenta
    // que el origen es un temporal de esta subida.
    if (!move_uploaded_file($temporal, $destino)) {
        throw new GgError(
            'No se pudo guardar la imagen en el servidor. Revisa los permisos de la carpeta /medios.',
            500
        );
    }

    // ── 9 · Permisos ────────────────────────────────────────────────────────
    // Lectura para quien sirva la web, escritura solo para el dueño y jamás el
    // bit de ejecución. Es la última red por debajo del .htaccess de /medios.
    @chmod($destino, 0644);

    $relativo = $carpeta . '/' . $nombre;

    // En el historial se guarda la ruta con su carpeta y no el nombre suelto:
    // al revisarlo semanas después hace falta saber dónde cayó el archivo.
    gg_auditar('crear', 'medios', null, $relativo, [], $usuario);

    gg_responder([
        'url'   => gg_url_medios($relativo),
        // null cuando no se pudieron medir (AVIF en un PHP que no lo lee). La
        // interfaz ya sabe tratar el tamaño como opcional.
        'ancho' => $ancho,
        'alto'  => $alto,
    ], 201);
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/medios — borrar una imagen del depósito
// ─────────────────────────────────────────────────────────────────────────────
if ($accion === '' && $metodo === 'DELETE') {
    // Borrar es de administrador: un editor sube y reemplaza, pero no destruye.
    $usuario = gg_exigir_rol('admin');

    $cuerpo = gg_cuerpo();
    $url = gg_texto_obligatorio($cuerpo, 'url', 400);

    $relativo = gg_ruta_medios_desde_url($url);
    if ($relativo === null) {
        // Mismo mensaje para todos los motivos de rechazo: detallar cuál falló
        // sería ir enseñando el mapa del disco a quien esté probando rutas.
        throw new GgError('Esa dirección no corresponde a una imagen del panel.', 400);
    }

    $base = realpath(gg_carpeta_medios());
    if ($base === false) {
        throw new GgError('No se encontró la carpeta de imágenes del sitio.', 500);
    }
    $base = rtrim(str_replace('\\', '/', $base), '/');

    // realpath resuelve enlaces simbólicos y cualquier «..» que hubiera
    // sobrevivido, y devuelve false si el archivo no existe.
    $destino = realpath(gg_carpeta_medios() . '/' . $relativo);

    // Que no exista no es un error: lo que se pedía era que esa imagen no
    // estuviera, y no está. Responder 404 aquí obligaría al panel a tratar como
    // fallo el caso más normal de todos (borrar dos veces, o borrar una imagen
    // que ya se había quitado a mano).
    if ($destino === false) {
        gg_responder(['ok' => true, 'borrado' => false]);
    }
    $destino = str_replace('\\', '/', $destino);

    // ── La comprobación que de verdad importa ───────────────────────────────
    // Después de resolverlo todo, el archivo TIENE que seguir colgando de
    // /medios. La barra final del prefijo no sobra: sin ella, una carpeta
    // hermana llamada «/mediosviejos» pasaría el filtro solo por empezar igual.
    if (!str_starts_with($destino, $base . '/')) {
        throw new GgError('Esa dirección no corresponde a una imagen del panel.', 400);
    }
    // Desde aquí no se borran carpetas, solo archivos.
    if (!is_file($destino)) {
        gg_responder(['ok' => true, 'borrado' => false]);
    }

    if (!@unlink($destino)) {
        throw new GgError(
            'No se pudo borrar la imagen. Revisa los permisos de la carpeta /medios.',
            500
        );
    }

    gg_auditar('eliminar', 'medios', null, $relativo, [], $usuario);

    gg_responder(['ok' => true, 'borrado' => true]);
}

gg_error('No existe esa dirección en la API.', 404);

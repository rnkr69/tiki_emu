package es.tikiemu

import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import android.provider.DocumentsContract.Document
import android.util.Log
import androidx.core.net.toUri
import java.io.File

/**
 * Catálogo de juegos: la carpeta que el usuario elige y lo que hay dentro.
 *
 * El problema que resuelve: `getExternalFilesDir` es una carpeta privada de la
 * app y en Android 15 ni siquiera se ve al conectar el móvil por USB, así que
 * meter juegos ahí es incómodo. Con el selector del sistema el usuario apunta a
 * donde ya tenga sus ROMs —`/sdcard/Roms`, una tarjeta SD, lo que sea— y se
 * recuerda entre arranques.
 */
object Biblioteca {

    private const val TAG = "tiki_emu"
    private const val PREFS = "tiki_emu"
    private const val CLAVE_RAIZ = "carpeta_roms"

    /** Hasta dónde se baja buscando. `Roms/<sistema>/<juego>` son dos niveles. */
    private const val PROFUNDIDAD_MAX = 4

    /** Tope de seguridad por si alguien elige la raíz de la tarjeta entera. */
    private const val MAX_FICHEROS = 5000

    data class Rom(
        val relativa: String,
        val nombre: String,
        val nucleo: String,
        /** Nombre de la consola: es lo que se enseña, no el núcleo. */
        val sistema: String,
        val tamano: Long,
        /** null cuando viene de la carpeta interna de respaldo. */
        val uri: Uri?,
        val fichero: File?
    )

    private val nucleos = mapOf(
        "nes" to "fceumm", "fds" to "fceumm",
        "sfc" to "snes9x", "smc" to "snes9x",
        "gb" to "mgba", "gbc" to "mgba", "gba" to "mgba",
        "md" to "genesis_plus_gx", "gen" to "genesis_plus_gx", "smd" to "genesis_plus_gx"
    )

    private val porCarpeta = mapOf(
        "nes" to "fceumm", "snes" to "snes9x", "gb" to "mgba",
        "gbc" to "mgba", "gba" to "mgba", "megadrive" to "genesis_plus_gx"
    )

    /**
     * Nombre de la consola, que es lo que ve el usuario. El núcleo («fceumm»,
     * «mgba») no le dice nada a nadie, y uno solo cubre varias consolas: por eso
     * el sistema se deduce de la extensión, no del núcleo.
     */
    private val sistemas = mapOf(
        "nes" to "NES", "fds" to "NES",
        "sfc" to "SNES", "smc" to "SNES",
        "gb" to "GAME BOY", "gbc" to "GBC", "gba" to "GBA",
        "md" to "MEGA DRIVE", "gen" to "MEGA DRIVE", "smd" to "MEGA DRIVE"
    )

    private val sistemaPorCarpeta = mapOf(
        "nes" to "NES", "snes" to "SNES", "gb" to "GAME BOY",
        "gbc" to "GBC", "gba" to "GBA", "megadrive" to "MEGA DRIVE"
    )

    /**
     * Índice de ruta relativa a juego. Se reemplaza entero al reescanear, nunca
     * se muta el publicado, así que una petición en vuelo no ve un índice a
     * medias.
     */
    @Volatile
    private var indice: Map<String, Rom> = emptyMap()

    @Volatile
    var raiz: Uri? = null
        private set

    @Volatile
    var escaneando = false
        private set

    fun hayCarpetaElegida(): Boolean = raiz != null

    // --- Elección y permiso --------------------------------------------------

    /** Recupera la carpeta elegida, si el permiso sigue vivo. */
    fun recuperar(contexto: Context) {
        val guardada = prefs(contexto).getString(CLAVE_RAIZ, null)?.toUri() ?: return
        // No basta con haberla guardado: el usuario puede haber revocado el
        // permiso desde los ajustes del sistema.
        val vigente = contexto.contentResolver.persistedUriPermissions
            .any { it.uri == guardada && it.isReadPermission }
        if (vigente) {
            raiz = guardada
        } else {
            Log.w(TAG, "el permiso sobre la carpeta de juegos ya no vale")
            prefs(contexto).edit().remove(CLAVE_RAIZ).apply()
        }
    }

    /** Guarda la carpeta que acaba de elegir el usuario. */
    fun fijarRaiz(contexto: Context, uri: Uri) {
        val cr = contexto.contentResolver
        // Solo lectura: pedir escritura lanzaría SecurityException si el permiso
        // concedido no la incluía, y aquí no se escribe nada.
        val flags = Intent.FLAG_GRANT_READ_URI_PERMISSION
        try {
            cr.takePersistableUriPermission(uri, flags)
        } catch (e: SecurityException) {
            Log.w(TAG, "no se pudo conservar el permiso de la carpeta", e)
            return
        }
        // El sistema limita cuántas carpetas puede recordar una app, así que se
        // suelta la anterior al cambiar.
        raiz?.takeIf { it != uri }?.let {
            runCatching { cr.releasePersistableUriPermission(it, flags) }
        }
        raiz = uri
        prefs(contexto).edit().putString(CLAVE_RAIZ, uri.toString()).apply()
    }

    private fun prefs(contexto: Context) =
        contexto.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    // --- Escaneo -------------------------------------------------------------

    /**
     * Recorre la carpeta y reconstruye el índice.
     *
     * Se consulta directamente con `DocumentsContract` en vez de usar
     * `DocumentFile`: este último resuelve nombre, tamaño y tipo con una llamada
     * entre procesos cada uno, así que 172 ROMs se convertirían en unas 500 idas
     * y vueltas. Pidiendo todas las columnas de golpe es una consulta por
     * carpeta.
     */
    fun escanear(contexto: Context) {
        if (escaneando) return
        escaneando = true
        try {
            val destino = raiz
            indice = if (destino != null) escanearSaf(contexto, destino)
                     else escanearCarpetaInterna(contexto)
            Log.i(TAG, "catálogo: ${indice.size} juegos")
        } catch (e: SecurityException) {
            // Permiso revocado mientras se usaba: se vuelve al estado «sin
            // carpeta» en vez de reintentar en bucle.
            Log.w(TAG, "sin permiso sobre la carpeta de juegos", e)
            raiz = null
            prefs(contexto).edit().remove(CLAVE_RAIZ).apply()
            indice = escanearCarpetaInterna(contexto)
        } catch (e: Exception) {
            Log.w(TAG, "no se pudo leer la carpeta de juegos", e)
        } finally {
            escaneando = false
        }
    }

    private val PROYECCION = arrayOf(
        Document.COLUMN_DOCUMENT_ID,
        Document.COLUMN_DISPLAY_NAME,
        Document.COLUMN_MIME_TYPE,
        Document.COLUMN_SIZE
    )

    private fun escanearSaf(contexto: Context, arbol: Uri): Map<String, Rom> {
        val cr: ContentResolver = contexto.contentResolver
        val encontrados = mutableMapOf<String, Rom>()

        // Pila de (documentId, ruta relativa, profundidad); nada de recursión.
        val pila = ArrayDeque<Triple<String, String, Int>>()
        pila.addLast(Triple(DocumentsContract.getTreeDocumentId(arbol), "", 0))

        while (pila.isNotEmpty() && encontrados.size < MAX_FICHEROS) {
            val (padre, prefijo, nivel) = pila.removeLast()
            val hijos = DocumentsContract.buildChildDocumentsUriUsingTree(arbol, padre)

            cr.query(hijos, PROYECCION, null, null, null)?.use { c ->
                while (c.moveToNext()) {
                    val id = c.getString(0)
                    val nombre = c.getString(1) ?: continue
                    if (nombre.startsWith(".")) continue
                    val mime = c.getString(2)
                    val tamano = c.getLong(3)
                    val relativa = if (prefijo.isEmpty()) nombre else "$prefijo/$nombre"

                    if (mime == Document.MIME_TYPE_DIR) {
                        if (nivel < PROFUNDIDAD_MAX) pila.addLast(Triple(id, relativa, nivel + 1))
                        continue
                    }

                    // El núcleo se deduce por extensión, y por la carpeta en los
                    // .zip. Nunca por el MIME: Android devuelve
                    // application/octet-stream para todas las ROMs.
                    val carpeta = prefijo.substringAfterLast('/')
                    val nucleo = nucleoDe(nombre, carpeta) ?: continue
                    encontrados[relativa] = Rom(
                        relativa = relativa,
                        nombre = nombreLegible(nombre),
                        nucleo = nucleo,
                        sistema = sistemaDe(nombre, carpeta),
                        tamano = tamano,
                        uri = DocumentsContract.buildDocumentUriUsingTree(arbol, id),
                        fichero = null
                    )
                }
            }
        }
        return encontrados
    }

    /** Respaldo mientras no haya carpeta elegida: la carpeta propia de la app. */
    private fun escanearCarpetaInterna(contexto: Context): Map<String, Rom> {
        val raizInterna = carpetaInterna(contexto)
        val encontrados = mutableMapOf<String, Rom>()
        raizInterna.walkTopDown()
            .filter { it.isFile && !it.name.startsWith(".") }
            .forEach { f ->
                val carpeta = f.parentFile?.name?.lowercase().orEmpty()
                val nucleo = nucleoDe(f.name, carpeta) ?: return@forEach
                val relativa = f.relativeTo(raizInterna).path.replace('\\', '/')
                encontrados[relativa] = Rom(
                    relativa = relativa,
                    nombre = nombreLegible(f.name),
                    nucleo = nucleo,
                    sistema = sistemaDe(f.name, carpeta),
                    tamano = f.length(),
                    uri = null,
                    fichero = f
                )
            }
        return encontrados
    }

    fun carpetaInterna(contexto: Context): File =
        File(contexto.getExternalFilesDir(null), "roms").apply { mkdirs() }

    private fun nucleoDe(nombre: String, carpetaPadre: String): String? {
        val ext = nombre.substringAfterLast('.', "").lowercase()
        return nucleos[ext] ?: if (ext == "zip") porCarpeta[carpetaPadre.lowercase()] else null
    }

    private fun sistemaDe(nombre: String, carpetaPadre: String): String {
        val ext = nombre.substringAfterLast('.', "").lowercase()
        return sistemas[ext] ?: sistemaPorCarpeta[carpetaPadre.lowercase()] ?: ""
    }

    private fun nombreLegible(nombre: String) =
        nombre.substringBeforeLast('.').replace(Regex("[_.]"), " ").trim()

    // --- Consulta ------------------------------------------------------------

    fun listado(): List<Rom> = indice.values.sortedBy { it.nombre.lowercase() }

    /**
     * Busca por ruta relativa exacta. Al no construir rutas de fichero, el
     * clásico `../` deja de ser un riesgo: si no está en el índice, no existe.
     */
    fun buscar(relativa: String): Rom? = indice[relativa]
}

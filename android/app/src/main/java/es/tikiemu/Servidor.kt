package es.tikiemu

import android.content.Context
import io.ktor.server.application.*
import io.ktor.server.cio.*
import io.ktor.server.engine.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.plugins.partialcontent.*
import io.ktor.server.websocket.*
import io.ktor.http.*
import io.ktor.http.content.OutgoingContent
import io.ktor.utils.io.*
import io.ktor.utils.io.jvm.javaio.toByteReadChannel
import io.ktor.websocket.*
import kotlinx.coroutines.channels.ClosedReceiveChannelException
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.NetworkInterface

/**
 * Servidor embebido: estáticos, catálogo de juegos y relay de entrada.
 *
 * Es la traducción de `server-node/server.js`. Lo que cambia respecto a la Fase
 * 1 es quién sirve los ficheros; el protocolo y las reglas son los mismos, y
 * `web/` se sirve tal cual desde los assets.
 */
class Servidor(private val contexto: Context, private val puerto: Int = 8080) {

    private val sala = Sala()

    /** Conexión del host (la pantalla) y conexiones de mandos. */
    private var host: Cliente? = null
    private val pads = mutableSetOf<Cliente>()
    private var siguienteId = 1

    inner class Cliente(val sesion: DefaultWebSocketServerSession) {
        val id: Int = siguienteId++
        var rol: String? = null
        var slot: Int? = null
        var token: String? = null

        suspend fun enviar(obj: JSONObject) {
            try {
                sesion.send(Frame.Text(obj.toString()))
            } catch (_: Exception) {
                /* la conexión se ha ido; el cierre lo maneja quien corresponda */
            }
        }
    }

    private var motor: EmbeddedServer<*, *>? = null

    fun arrancar() {
        motor = embeddedServer(CIO, port = puerto, host = "0.0.0.0") {
            install(WebSockets)
            // Los núcleos piden trozos del fichero, no siempre el fichero
            // entero: con esto responde 206 sin código propio.
            install(PartialContent)
            rutas()
        }.also { it.start(wait = false) }
    }

    /** Lo que sabe hacer este servidor, para que la web enseñe solo lo que aplica. */
    private fun capacidadesJson() = JSONObject().put("elegirCarpeta", true)

    fun parar() {
        motor?.stop(500, 1000)
        motor = null
    }

    // --- Rutas ---------------------------------------------------------------

    private fun Application.rutas() = routing {
        get("/api/roms") {
            call.respondText(catalogoJson().toString(), ContentType.Application.Json)
        }

        webSocket("/") { atender(this) }

        // Estáticos desde los assets. Se sirven a mano en vez de con el plugin
        // de recursos porque viven en el AssetManager, no en el classpath.
        get("/{ruta...}") {
            val ruta = call.parameters.getAll("ruta")?.joinToString("/").orEmpty()
            servirEstatico(call, if (ruta.isEmpty()) "index.html" else ruta)
        }
    }

    private suspend fun servirEstatico(call: ApplicationCall, rutaPedida: String) {
        val ruta = rutaPedida.trimStart('/')

        // Las ROMs no van dentro del APK: viven donde el usuario las tenga.
        if (ruta.startsWith("roms/")) {
            servirRom(call, ruta.removePrefix("roms/"))
            return
        }

        try {
            val bytes = contexto.assets.open("web/$ruta").use { it.readBytes() }
            call.response.headers.append(HttpHeaders.CacheControl, "no-store")
            // 127.0.0.1 es contexto seguro: con estas dos cabeceras se habilita
            // SharedArrayBuffer, y con él los núcleos con hilos del emulador.
            call.response.headers.append("Cross-Origin-Opener-Policy", "same-origin")
            call.response.headers.append("Cross-Origin-Embedder-Policy", "require-corp")
            call.respondBytes(bytes, tipoDe(ruta))
        } catch (_: Exception) {
            call.respond(HttpStatusCode.NotFound, "No encontrado")
        }
    }

    private fun tipoDe(nombre: String): ContentType = when (nombre.substringAfterLast('.', "")) {
        "html" -> ContentType.Text.Html
        "js", "mjs" -> ContentType.Text.JavaScript
        "css" -> ContentType.Text.CSS
        "json" -> ContentType.Application.Json
        "wasm" -> ContentType("application", "wasm")
        "png" -> ContentType.Image.PNG
        "jpg", "jpeg" -> ContentType.Image.JPEG
        "svg" -> ContentType.Image.SVG
        "woff2" -> ContentType("font", "woff2")
        else -> ContentType.Application.OctetStream
    }

    // --- Catálogo ------------------------------------------------------------

    private fun catalogoJson(): JSONArray = JSONArray(
        Biblioteca.listado().map { rom ->
            JSONObject()
                .put("nombre", rom.nombre)
                .put("url", "/roms/" + rom.relativa.split("/").joinToString("/") { codificar(it) })
                .put("nucleo", rom.nucleo)
                .put("sistema", rom.sistema)
                .put("tamano", rom.tamano)
        }
    )

    private fun codificar(tramo: String): String =
        java.net.URLEncoder.encode(tramo, "UTF-8").replace("+", "%20")

    /**
     * Sirve una ROM por streaming.
     *
     * Nada de leerla entera: una de GBA son 32 MB y reservarlos de golpe es la
     * receta para quedarse sin memoria. El tamaño sale del índice, así que no
     * hace falta preguntarle nada al sistema en el camino caliente.
     */
    private suspend fun servirRom(call: ApplicationCall, rutaRelativa: String) {
        // Ktor ya entrega los tramos decodificados; volver a decodificar aquí
        // rompería los nombres con % o +.
        val rom = Biblioteca.buscar(rutaRelativa)
        if (rom == null) {
            call.respond(HttpStatusCode.NotFound, "No encontrado")
            return
        }

        val tipo = tipoDe(rutaRelativa)
        try {
            val fichero = rom.fichero
            if (fichero != null) {
                call.respondFile(fichero)
                return
            }
            val uri = rom.uri ?: throw IllegalStateException("juego sin origen")
            call.respond(object : OutgoingContent.ReadChannelContent() {
                override val contentType = tipo
                override val contentLength = rom.tamano
                override fun readFrom(): ByteReadChannel =
                    contexto.contentResolver.openInputStream(uri)!!.toByteReadChannel()
            })
        } catch (e: Exception) {
            // El fichero puede haberse borrado, o la tarjeta estar fuera. Un 404
            // es más útil que un 500 con traza.
            call.respond(HttpStatusCode.NotFound, "No se pudo leer el juego")
        }
    }

    // --- Protocolo -----------------------------------------------------------

    private suspend fun atender(sesion: DefaultWebSocketServerSession) {
        val cliente = Cliente(sesion)
        try {
            for (frame in sesion.incoming) {
                when (frame) {
                    is Frame.Binary -> reenviarEntrada(cliente, frame.data)
                    is Frame.Text -> control(cliente, JSONObject(frame.readText()))
                    else -> {}
                }
            }
        } catch (_: ClosedReceiveChannelException) {
            /* cierre normal */
        } finally {
            cerrar(cliente)
        }
    }

    /**
     * Canal de entrada. El servidor no interpreta la máscara: solo reenvía, y
     * sobrescribe el byte 0 con el slot de esta conexión para que un mando no
     * pueda suplantar a otro (§6.2).
     */
    private suspend fun reenviarEntrada(cliente: Cliente, datos: ByteArray) {
        if (cliente.rol != "pad") return
        val slot = cliente.slot ?: return
        if (datos.size != 4) return
        val destino = host ?: return
        val paquete = datos.copyOf()
        paquete[0] = slot.toByte()
        try {
            destino.sesion.send(Frame.Binary(true, paquete))
        } catch (_: Exception) {
        }
    }

    private suspend fun control(cliente: Cliente, msg: JSONObject) {
        when (msg.optString("t")) {
            "hello" -> saludar(cliente, msg)
            "claim" -> reclamar(cliente, msg.optInt("slot", -1))
            "release" -> {
                if (cliente.rol != "pad") return
                cliente.token?.let { sala.soltar(it) }
                cliente.slot = null
                cliente.enviar(JSONObject().put("t", "claimed").put("slot", JSONObject.NULL))
                difundirSlots()
            }
            "kick" -> expulsar(cliente, msg.optInt("slot", -1))
            "hotkey" -> {
                if (cliente.rol != "pad" || cliente.slot != 1) return
                host?.enviar(
                    JSONObject().put("t", "hotkey").put("id", msg.optString("id")).put("slot", 1)
                )
            }
            "stats" -> {
                if (cliente.rol != "pad") return
                val slot = cliente.slot ?: return
                val datos = msg.optJSONObject("datos") ?: JSONObject()
                host?.enviar(JSONObject(datos.toString()).put("t", "stats").put("slot", slot))
            }
            "elegir-carpeta" -> {
                // El servidor vive en un servicio y no puede abrir el selector:
                // solo puede avisar a quien tiene ventana.
                if (cliente.rol == "host") ServidorService.alPedirCarpeta?.invoke()
            }
            "ping" -> cliente.enviar(JSONObject().put("t", "pong").put("ts", msg.opt("ts")))
            "echo" -> eco(cliente, msg)
        }
    }

    private suspend fun saludar(cliente: Cliente, msg: JSONObject) {
        if (msg.optString("role") == "host") {
            host = cliente
            cliente.rol = "host"
            cliente.enviar(
                JSONObject()
                    .put("t", "welcome")
                    .put("role", "host")
                    .put("slots", slotsJson())
                    .put("direcciones", direccionesJson())
                    .put("red", redJson())
                    .put("capacidades", capacidadesJson())
            )
            return
        }

        cliente.rol = "pad"
        pads.add(cliente)
        // Un token conocido recupera su slot sin pasar por la selección.
        // optString devuelve "" cuando no viene, no null: hay que distinguirlo
        // a mano o se acaba buscando el slot de una cadena vacía.
        val tokenRecibido = msg.optString("token").takeIf { it.isNotEmpty() }
        val previo = sala.slotDe(tokenRecibido)
        cliente.token = if (previo != null) tokenRecibido else sala.crearToken()
        if (previo != null) {
            sala.reclamar(previo, cliente.token!!)
            cliente.slot = previo
        }
        cliente.enviar(
            JSONObject()
                .put("t", "welcome")
                .put("role", "pad")
                .put("token", cliente.token)
                .put("slot", cliente.slot ?: JSONObject.NULL)
                .put("slots", slotsJson())
        )
        if (previo != null) difundirSlots()
    }

    private suspend fun reclamar(cliente: Cliente, slot: Int) {
        if (cliente.rol != "pad") return
        val token = cliente.token ?: return
        if (sala.llena() && sala.slotDe(token) == null) {
            cliente.enviar(JSONObject().put("t", "error").put("code", "ROOM_FULL").put("slots", slotsJson()))
            return
        }
        when (val r = sala.reclamar(slot, token)) {
            is Sala.Resultado.Error ->
                // Se devuelve la lista actualizada para poder reintentar sin
                // esperar otro mensaje (HU-07).
                cliente.enviar(JSONObject().put("t", "error").put("code", r.code).put("slots", slotsJson()))
            is Sala.Resultado.Ok -> {
                cliente.slot = r.slot
                cliente.enviar(JSONObject().put("t", "claimed").put("slot", r.slot))
                difundirSlots()
            }
        }
    }

    /** Solo el jugador 1 puede echar a otro, y nunca a sí mismo (HU-10). */
    private suspend fun expulsar(cliente: Cliente, slot: Int) {
        val esJugador1 = cliente.rol == "pad" && cliente.slot == 1
        if (!esJugador1 && cliente.rol != "host") return
        if (slot == cliente.slot) return

        val victima = pads.find { it.slot == slot }
        sala.expulsar(slot)
        victima?.let {
            it.slot = null
            it.token = null
            it.enviar(JSONObject().put("t", "kicked"))
        }
        difundirSlots()
    }

    /**
     * El eco viaja con el id del mando que lo originó: sin eso, con dos mandos
     * sondeando a la vez las respuestas se cruzan y cada uno resta contra el
     * reloj del otro.
     */
    private suspend fun eco(cliente: Cliente, msg: JSONObject) {
        if (cliente.rol == "pad") {
            host?.enviar(JSONObject().put("t", "echo").put("ts", msg.opt("ts")).put("id", cliente.id))
        } else if (cliente.rol == "host") {
            pads.find { it.id == msg.optInt("id", -1) }
                ?.enviar(JSONObject().put("t", "echo-pong").put("ts", msg.opt("ts")))
        }
    }

    private suspend fun cerrar(cliente: Cliente) {
        if (cliente === host) host = null
        if (pads.remove(cliente)) {
            // El slot no se libera de inmediato: queda reservado por si el mando
            // vuelve tras un bloqueo de pantalla.
            val token = cliente.token
            if (token != null && sala.slotDe(token) != null) {
                sala.desconectar(token)
                difundirSlots()
            }
        }
    }

    private suspend fun difundirSlots() {
        val mensaje = JSONObject().put("t", "slots").put("slots", slotsJson())
        host?.enviar(mensaje)
        pads.toList().forEach { it.enviar(JSONObject(mensaje.toString())) }
    }

    private fun slotsJson(): JSONArray = JSONArray(
        sala.listaSlots().map {
            JSONObject().put("n", it.n).put("taken", it.taken).put("conectado", it.conectado)
        }
    )

    // --- Red -----------------------------------------------------------------

    /**
     * Direcciones por las que los mandos pueden alcanzar esta consola. El host
     * se sirve en 127.0.0.1 y desde ahí no puede saberlo: solo lo sabe quien
     * escucha.
     */
    fun direcciones(): List<String> =
        NetworkInterface.getNetworkInterfaces().toList()
            .filter { it.isUp && !it.isLoopback }
            .flatMap { iface ->
                iface.inetAddresses.toList()
                    .filter { !it.isLoopbackAddress && it.hostAddress?.contains(':') == false }
                    .mapNotNull { dir -> dir.hostAddress?.let { iface.name to it } }
            }
            .sortedByDescending { (iface, ip) -> prioridadRed(iface, ip) }
            .map { it.second }

    /**
     * Cuando la consola crea su propia red, el móvil puede tener dos interfaces
     * a la vez: la del WiFi de casa y la del hotspot. La buena es la del
     * hotspot, porque es donde están los mandos — y se reconoce por el nombre de
     * la interfaz, que es mucho más fiable que adivinar por el rango de IP.
     */
    private fun prioridadRed(iface: String, ip: String): Int = when {
        iface.startsWith("ap") || iface.contains("softap") -> 5
        ip.startsWith("192.168.43.") -> 3
        ip.startsWith("192.168.") -> 2
        ip.startsWith("10.") || ip.startsWith("172.") -> 1
        else -> 0
    }

    private fun direccionesJson(): JSONArray = JSONArray(
        direcciones().map { JSONObject().put("ip", it).put("puerto", puerto) }
    )

    /**
     * Credenciales de la red propia, si la hay. La web no sabe de dónde salen ni
     * le importa: las recibe por el protocolo, como todo lo demás.
     */
    private fun redJson(): Any {
        val red = Hotspot.red
            ?: return Hotspot.motivoFallo?.let { JSONObject().put("error", it) } ?: JSONObject.NULL
        return JSONObject().put("ssid", red.ssid).put("clave", red.clave ?: JSONObject.NULL)
    }

    /**
     * Avisa al lobby de que la red ha cambiado, sin esperar a que recargue.
     *
     * Van también las direcciones: al levantarse el hotspot aparece una interfaz
     * nueva, y el QR del mando tiene que apuntar ahí. Si no, sigue enseñando la
     * IP de la red anterior y los invitados no llegan.
     */
    suspend fun anunciarRed() {
        host?.enviar(
            JSONObject()
                .put("t", "red")
                .put("red", redJson())
                .put("direcciones", direccionesJson())
        )
    }

    /** Barrido de reservas vencidas, que el servicio llama periódicamente. */
    suspend fun limpiarCaducados() {
        if (sala.limpiarCaducados().isNotEmpty()) difundirSlots()
    }

    /** Avisa al lobby de que el catálogo ha cambiado, tras elegir carpeta. */
    suspend fun anunciarCatalogo() {
        host?.enviar(JSONObject().put("t", "catalogo"))
    }
}

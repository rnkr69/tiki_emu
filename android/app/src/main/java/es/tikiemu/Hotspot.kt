package es.tikiemu

import android.content.Context
import android.net.wifi.SoftApConfiguration
import android.net.wifi.WifiManager
import android.net.wifi.WifiSsid
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log

/**
 * Crea la red WiFi propia de la consola con `startLocalOnlyHotspot()`.
 *
 * Es la razón de ser de la Fase 4 en lo que toca al emparejamiento: en la Fase 1
 * había que activar el hotspot a mano y leer la contraseña de los ajustes. Aquí
 * la red la crea la app y devuelve las credenciales, que se pintan como QR.
 *
 * «Local only» significa que la red no comparte internet: es exactamente lo que
 * queremos, porque la consola no lo necesita y así el sistema no exige que haya
 * datos móviles.
 */
object Hotspot {

    private const val TAG = "tiki_emu"

    data class Red(val ssid: String, val clave: String?)

    /** Credenciales de la red creada, o null si no hay hotspot propio. */
    @Volatile
    var red: Red? = null
        private set

    /**
     * Por qué no se pudo crear, como código y no como frase: la frase la elige
     * el navegador que la va a enseñar, en el idioma de quien mira. Mismo
     * criterio que los códigos de error del protocolo (§6.1).
     */
    @Volatile
    var motivoFallo: String? = null
        private set

    private var reserva: WifiManager.LocalOnlyHotspotReservation? = null
    private var enMarcha = false

    /** Nombre de la red cuando el sistema deja elegirlo. */
    private const val SSID_DESEADO = "tiki_emu"

    /**
     * Contraseña fija. Va a la vista en el QR de la red, así que no es un
     * secreto: solo impide que la red quede abierta, que algunos móviles
     * rechazan. Debe tener al menos 8 caracteres para WPA2.
     */
    private const val CLAVE_DESEADA = "tikiemu2026"

    /** API 36 es la primera que permite elegir el nombre de la red. */
    val puedeElegirNombre: Boolean
        get() = Build.VERSION.SDK_INT >= 36

    /**
     * @param alCambiar se llama cuando hay novedades, para que el lobby se entere.
     */
    fun arrancar(contexto: Context, alCambiar: () -> Unit) {
        if (enMarcha) return
        enMarcha = true
        motivoFallo = null

        val wifi = contexto.applicationContext
            .getSystemService(Context.WIFI_SERVICE) as WifiManager

        try {
            val respuesta = object : WifiManager.LocalOnlyHotspotCallback() {
                    override fun onStarted(reservation: WifiManager.LocalOnlyHotspotReservation) {
                        reserva = reservation
                        red = leerCredenciales(reservation)
                        Log.i(TAG, "hotspot creado: ${red?.ssid}")
                        alCambiar()
                    }

                    override fun onStopped() {
                        Log.i(TAG, "hotspot detenido")
                        red = null
                        enMarcha = false
                        alCambiar()
                    }

                    override fun onFailed(reason: Int) {
                        // Los fabricantes capan esto con cierta alegría; la
                        // alternativa es seguir con la red actual, así que no es
                        // un error fatal.
                        red = null
                        enMarcha = false
                        motivoFallo = when (reason) {
                            ERROR_NO_CHANNEL -> "SIN_CANAL"
                            ERROR_GENERIC -> "GENERICO"
                            ERROR_INCOMPATIBLE_MODE -> "MODO_INCOMPATIBLE"
                            ERROR_TETHERING_DISALLOWED -> "COMPARTICION_BLOQUEADA"
                            // El código numérico se queda en el registro: al
                            // usuario no le dice nada y el navegador ya tiene un
                            // texto genérico para lo que no conoce.
                            else -> "GENERICO"
                        }
                        Log.w(TAG, "hotspot falló con razón $reason")
                        Log.w(TAG, "hotspot falló: $motivoFallo")
                        alCambiar()
                    }
            }

            // Elegir el nombre de la red solo es posible desde Android 16. En
            // versiones anteriores el sistema genera uno como «AndroidShare_5195»
            // y no hay forma de cambiarlo desde una app normal: la variante que
            // acepta configuración no existe, y escribir la del hotspot del
            // sistema requiere permisos reservados a apps de plataforma.
            if (puedeElegirNombre) {
                val config = SoftApConfiguration.Builder()
                    .setWifiSsid(WifiSsid.fromBytes(SSID_DESEADO.toByteArray(Charsets.UTF_8)))
                    .setPassphrase(CLAVE_DESEADA, SoftApConfiguration.SECURITY_TYPE_WPA2_PSK)
                    .build()
                wifi.startLocalOnlyHotspotWithConfiguration(
                    config, contexto.mainExecutor, respuesta
                )
            } else {
                wifi.startLocalOnlyHotspot(respuesta, Handler(Looper.getMainLooper()))
            }
        } catch (e: SecurityException) {
            // Falta el permiso: se pide desde la actividad, pero puede haberse
            // denegado.
            enMarcha = false
            motivoFallo = "SIN_PERMISO"
            Log.w(TAG, "hotspot sin permiso", e)
            alCambiar()
        } catch (e: IllegalStateException) {
            enMarcha = false
            motivoFallo = "WIFI_APAGADO"
            Log.w(TAG, "hotspot no disponible", e)
            alCambiar()
        }
    }

    fun parar() {
        reserva?.close()
        reserva = null
        red = null
        enMarcha = false
    }

    @Suppress("DEPRECATION")
    private fun leerCredenciales(r: WifiManager.LocalOnlyHotspotReservation): Red? {
        // La forma moderna llegó en API 30; por debajo solo existe la antigua.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val cfg = r.softApConfiguration
            val ssid = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                cfg.wifiSsid?.toString()?.trim('"')
            } else {
                cfg.ssid
            }
            return ssid?.let { Red(it, cfg.passphrase) }
        }
        val cfg = r.wifiConfiguration ?: return null
        return Red(cfg.SSID.trim('"'), cfg.preSharedKey?.trim('"'))
    }
}

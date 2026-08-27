package es.tikiemu

import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.WindowManager
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.io.IOException
import java.net.InetSocketAddress
import java.net.Socket

/**
 * La ventana de la consola: un WebView a pantalla completa sobre el servidor
 * local.
 *
 * Equivalencia web: la Activity es la ventana del navegador y el WebView es la
 * pestaña. Aquí no hay barra de direcciones ni pestañas, así que la web ocupa
 * todo — que era el otro problema de la Fase 1.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var web: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // El servidor arranca antes que la ventana: cuando el WebView pida la
        // página, ya hay quien responda.
        startForegroundService(Intent(this, ServidorService::class.java))

        // La pantalla no se apaga mientras la consola está delante (HU-03).
        // Esta es la vía nativa y sustituye al apaño de NoSleep.js.
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        pantallaCompleta()

        web = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            // Chrome y el WebView bloquean el audio sin gesto previo; aquí se
            // permite, porque el gesto ya lo dio quien abrió la app.
            settings.mediaPlaybackRequiresUserGesture = false

            // Todo lo que no sea la propia consola se queda fuera: no hay
            // navegación a ningún otro sitio.
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(
                    view: WebView?, request: WebResourceRequest?
                ): Boolean = request?.url?.host !in listOf("127.0.0.1", "localhost")
            }
        }
        setContentView(web)
        cargarCuandoElServidorResponda()
        pedirPermisosYCrearRed()
    }

    override fun onResume() {
        super.onResume()
        // El selector solo puede abrirlo una ventana viva, así que el enganche
        // se pone al volver a primer plano y se quita al salir.
        ServidorService.alPedirCarpeta = {
            runOnUiThread { selectorCarpeta.launch(null) }
        }
    }

    override fun onPause() {
        ServidorService.alPedirCarpeta = null
        super.onPause()
    }

    /**
     * Permisos y red propia.
     *
     * Crear un hotspot exige permiso: en Android 13+ es NEARBY_WIFI_DEVICES, y
     * antes era el de ubicación —un requisito histórico de las APIs de WiFi que
     * siempre sorprende, porque aquí no se usa la ubicación para nada—.
     *
     * Si el usuario lo deniega o el fabricante capa la función, la consola sigue
     * siendo perfectamente usable con la red a la que ya esté conectado el
     * móvil: por eso no se bloquea nada, solo se avisa (HU-05).
     */
    private fun pedirPermisosYCrearRed() {
        val pendientes = mutableListOf<String>()

        val permisoRed = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            android.Manifest.permission.NEARBY_WIFI_DEVICES
        } else {
            android.Manifest.permission.ACCESS_FINE_LOCATION
        }
        if (checkSelfPermission(permisoRed) != PackageManager.PERMISSION_GRANTED) {
            pendientes.add(permisoRed)
        }

        // La notificación del servicio en primer plano también se pide desde 13.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED
        ) {
            pendientes.add(android.Manifest.permission.POST_NOTIFICATIONS)
        }

        if (pendientes.isEmpty()) {
            crearRed()
        } else {
            permisos.launch(pendientes.toTypedArray())
        }
    }

    private val permisos = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { crearRed() }   // se intenta igual: si falta permiso, Hotspot lo dirá

    /**
     * Selector de carpeta de juegos. Lo lanza la actividad porque un servicio no
     * puede abrir ventanas; el lobby solo pide que se abra, por el protocolo.
     */
    private val selectorCarpeta = registerForActivityResult(
        ActivityResultContracts.OpenDocumentTree()
    ) { uri ->
        if (uri == null) return@registerForActivityResult
        Biblioteca.fijarRaiz(this, uri)
        lifecycleScope.launch(Dispatchers.IO) {
            Biblioteca.escanear(this@MainActivity)
            ServidorService.instancia?.anunciarCatalogo()
        }
    }

    private fun crearRed() {
        Hotspot.arrancar(this) {
            // El lobby ya está abierto: se le avisa por el mismo canal que todo
            // lo demás, en vez de recargarlo.
            ServidorService.instancia?.let { servidor ->
                lifecycleScope.launch { servidor.anunciarRed() }
            }
        }
    }

    /**
     * El servicio y la ventana arrancan a la vez, y Ktor tarda un instante en
     * empezar a escuchar. Cargar la página sin más da un ERR_CONNECTION_REFUSED
     * en la cara del usuario, así que se espera a que el puerto acepte
     * conexiones y solo entonces se carga.
     */
    private fun cargarCuandoElServidorResponda() {
        val principal = Handler(Looper.getMainLooper())
        Thread {
            val limite = System.currentTimeMillis() + 15_000
            while (System.currentTimeMillis() < limite) {
                try {
                    Socket().use { it.connect(InetSocketAddress("127.0.0.1", 8080), 300) }
                    principal.post { web.loadUrl("http://127.0.0.1:8080/") }
                    return@Thread
                } catch (_: IOException) {
                    Thread.sleep(150)
                }
            }
            // Si en quince segundos no ha levantado, algo va mal de verdad y es
            // mejor decirlo que dejar una pantalla en blanco.
            principal.post {
                web.loadData(
                    "<body style='background:#06060c;color:#e8f4ff;font:16px system-ui;padding:2rem'>" +
                        "<h1>${getString(R.string.sin_arrancar_titulo)}</h1>" +
                        "<p>${getString(R.string.sin_arrancar_texto)}</p></body>",
                    "text/html", "utf-8"
                )
            }
        }.start()
    }

    /** Sin barras del sistema: la consola es la pantalla entera. */
    private fun pantallaCompleta() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) pantallaCompleta()
    }

    /**
     * El botón atrás navega dentro de la web si puede; si no, deja la app en
     * segundo plano en vez de cerrarla, para no tirar la partida por un gesto.
     */
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (web.canGoBack()) web.goBack() else moveTaskToBack(true)
    }

    override fun onDestroy() {
        web.destroy()
        super.onDestroy()
    }
}

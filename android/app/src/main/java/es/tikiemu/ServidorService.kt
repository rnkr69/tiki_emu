package es.tikiemu

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Mantiene el servidor vivo mientras la consola está en marcha.
 *
 * Es la pieza que arregla el problema de fondo de la Fase 1: Android congela un
 * proceso normal en cuanto sales de la app, y con Termux eso cortaba la partida.
 * Un servicio en primer plano, con su notificación visible, no se congela.
 *
 * Equivalencia web, por si ayuda: piensa en el servicio como un proceso que
 * sigue corriendo aunque cierres la pestaña, y en la notificación como el precio
 * que Android cobra por ello — tiene que ser visible para el usuario.
 */
class ServidorService : Service() {

    companion object {
        const val CANAL = "consola"
        const val ID_NOTIFICACION = 1
        const val ACCION_PARAR = "es.tikiemu.PARAR"

        /** El servidor lo comparte la actividad para leer direcciones y carpeta. */
        @Volatile
        var instancia: Servidor? = null

        /**
         * Qué hacer cuando el lobby pide elegir carpeta. Vive aquí y no en la
         * instancia del servidor porque la ventana puede registrarse antes de
         * que el servicio haya creado el servidor, y entonces el enganche se
         * perdía.
         */
        @Volatile
        var alPedirCarpeta: (() -> Unit)? = null
    }

    private val ambito = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var servidor: Servidor? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACCION_PARAR) {
            pararTodo()
            return START_NOT_STICKY
        }

        if (servidor == null) {
            crearCanal()
            startForeground(ID_NOTIFICACION, notificacion())
            servidor = Servidor(applicationContext).also {
                it.arrancar()
                instancia = it
            }
            // El catálogo se construye aparte del arranque: leer una carpeta con
            // cientos de juegos no debe retrasar que el servidor escuche.
            ambito.launch {
                Biblioteca.recuperar(applicationContext)
                Biblioteca.escanear(applicationContext)
                servidor?.anunciarCatalogo()
            }
            // Barrido de reservas vencidas, como el setInterval del servidor Node.
            ambito.launch {
                while (isActive) {
                    delay(5_000)
                    servidor?.limpiarCaducados()
                }
            }
        }
        // START_STICKY: si el sistema llega a matarlo por memoria, que lo
        // reviva. Es lo contrario de lo que hacía Termux.
        return START_STICKY
    }

    override fun onDestroy() {
        pararTodo()
        super.onDestroy()
    }

    private fun pararTodo() {
        ambito.cancel()
        servidor?.parar()
        servidor = null
        instancia = null
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun crearCanal() {
        val gestor = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val canal = NotificationChannel(
            CANAL,
            getString(R.string.canal_consola),
            NotificationManager.IMPORTANCE_LOW   // sin sonido: molestaría en partida
        )
        gestor.createNotificationChannel(canal)
    }

    private fun notificacion(): Notification {
        val abrir = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )
        // La notificación lleva su propia acción de parar (HU-02).
        val parar = PendingIntent.getService(
            this, 1,
            Intent(this, ServidorService::class.java).setAction(ACCION_PARAR),
            PendingIntent.FLAG_IMMUTABLE
        )

        return Notification.Builder(this, CANAL)
            .setContentTitle(getString(R.string.app_name))
            .setContentText(getString(R.string.consola_en_marcha))
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentIntent(abrir)
            .addAction(
                Notification.Action.Builder(null, getString(R.string.parar), parar).build()
            )
            .setOngoing(true)
            .build()
    }
}

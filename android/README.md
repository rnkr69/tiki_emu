# tiki_emu para Android (Fase 4)

La misma consola, empaquetada como app. Cambia quién sirve los ficheros —Ktor en vez de Node— y
quién abre la ventana —un `WebView` en vez de Chrome—. **`web/` no se toca**: se copia tal cual a
los assets con una tarea de Gradle.

## Estado

Los cuatro puntos de la Fase 4, funcionando en el Moto G05:

1. `WebView` a pantalla completa sobre `http://127.0.0.1:8080`.
2. `ForegroundService` con Ktor sirviendo `web/` desde los assets.
3. `startLocalOnlyHotspot()` con los dos QR: red y mando.
4. `web/` copiado sin modificaciones.

Probado: la app arranca, crea su red, sirve la web, un mando remoto se conecta por WiFi, reclama
puesto y el juego responde (`135 paq · 0 desc · J1: 5.3/16.9 ms`).

**Pendiente de probar con un móvil de verdad conectado al hotspot**: hasta ahora el mando ha sido el
navegador de un PC en la misma red, no un invitado sobre la red propia de la consola.

## Sobre el hotspot

`startLocalOnlyHotspot()` crea una red **efímera y sin salida a internet**, que es justo lo que
queremos: no hace falta que el móvil tenga datos.

Dos consecuencias que conviene conocer:

- **El SSID y la contraseña cambian en cada arranque** (`AndroidShare_5195`, `AndroidShare_2775`…).
  No es un fallo: es cómo funciona esta API. Por eso el QR de la red es imprescindible — nadie va a
  teclear una contraseña nueva cada tarde.

  **Poner nombre propio a la red solo es posible desde Android 16 (API 36)**, con
  `startLocalOnlyHotspotWithConfiguration`. El código ya lo usa cuando está disponible, y entonces la
  red se llama `tiki_emu` con contraseña fija; por debajo de API 36 esa variante no existe, y
  escribir la configuración del hotspot del sistema requiere permisos reservados a apps de
  plataforma. El Moto G05 va con Android 15, así que ahí el nombre lo sigue poniendo el sistema.
- **En este móvil el hotspot convive con el WiFi de casa**: aparecen dos interfaces, `wlan0` y
  `ap0`. El QR del mando debe apuntar a la del hotspot, y se distingue por el **nombre de la
  interfaz**, no por el rango de IP, que es mucho más fiable.

Si el fabricante lo capa o el usuario deniega el permiso, la consola sigue funcionando con la red a
la que ya esté conectado el móvil: se avisa en el lobby y no se bloquea nada (HU-05).

## Compilar e instalar

Con el móvil conectado y la depuración USB activada:

```sh
cd android
./gradlew :app:assembleDebug
"$ANDROID_HOME/platform-tools/adb" install -r app/build/outputs/apk/debug/app-debug.apk
```

`local.properties` apunta al SDK de cada máquina y no se versiona. Si falta, se crea con:

```
sdk.dir=C:/Users/tu-usuario/AppData/Local/Android/Sdk
```

Con barras normales: en un fichero `.properties` las contrabarras son escapes, y una ruta con
`\U` revienta con un críptico «Invalid file path».

## Dónde van los juegos

**Los eliges tú**: en el lobby, «Carpeta de juegos» abre el selector del sistema y la carpeta queda
recordada entre arranques. Lo normal es apuntar a `/sdcard/Roms`, la misma que usa la versión de
Termux, para no tener los juegos duplicados.

Mientras no se elija ninguna, se usa la carpeta privada de la app
(`/sdcard/Android/data/es.tikiemu/files/roms`) como respaldo, así que la ROM de prueba sigue
funcionando desde el primer arranque.

No van dentro del APK a propósito: el proyecto no distribuye ROMs.

### Cómo se leen

- Se consulta con `DocumentsContract` y proyección, **no** con `DocumentFile`: este último resuelve
  nombre y tamaño con una llamada entre procesos por cada fichero, y 172 ROMs se convertirían en
  unas 500 idas y vueltas. Así son unas pocas consultas, una por carpeta.
- El resultado se guarda en un índice en memoria de ruta a documento, porque las URIs del selector
  no son rutas y no se pueden concatenar. Efecto colateral bueno: al buscar por clave exacta, un
  `../` en la URL simplemente no existe en el índice.
- Se sirven por *streaming* con `PartialContent`: una ROM de GBA son 32 MB y leerla entera en
  memoria es la vía rápida a un `OutOfMemoryError`.

## Cosas que costaron y conviene no repetir

- **AGP 9 trae Kotlin incorporado.** Declarar además `org.jetbrains.kotlin.android` hace fallar la
  construcción con un mensaje claro, pero es fácil arrastrarlo de plantillas viejas.
- **AGP 9 no admite `sourceSets.assets.srcDir(provider)`.** Los directorios generados se declaran
  por variante con `addGeneratedSourceDirectory`, que además encadena las dependencias solo.
- **Android bloquea el HTTP en claro** desde Android 9: el WebView daba
  `ERR_CLEARTEXT_NOT_PERMITTED`. Se permite solo para `127.0.0.1` y `localhost` con
  `network_security_config.xml`; el resto del tráfico sigue exigiendo HTTPS.
- **El servidor tarda un instante en escuchar.** Cargar la página nada más crear la ventana da
  `ERR_CONNECTION_REFUSED`: hay que esperar a que el puerto acepte conexiones.
- **PowerShell corrompe los binarios al redirigir.** Para `adb exec-out screencap -p > archivo.png`
  hay que usar una shell POSIX, o el PNG sale con BOM y no se abre.

## Depuración útil

Ver el servidor del móvil desde el PC, sin depender del WiFi:

```sh
adb forward tcp:9090 tcp:8080
curl http://localhost:9090/api/roms
```

Captura de pantalla del móvil:

```sh
adb exec-out screencap -p > pantalla.png
```

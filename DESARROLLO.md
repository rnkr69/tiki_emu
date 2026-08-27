# Desarrollo

*[Read this in English](DEVELOPMENT.md)*

Cómo arrancar tiki_emu desde el código, y cómo compilar las aplicaciones. Nada de esto hace falta
para **usar** la consola: para eso están las descargas del [README](README.es.md).

Sí hace falta ahora mismo, porque todavía no se ha publicado ninguna versión.

---

## El servidor de desarrollo

Es la forma más rápida de ver la consola funcionando. Necesita [Node.js](https://nodejs.org) 18 o
posterior.

```sh
cd server-node
npm install      # una sola dependencia: ws
node server.js
```

- **Consola** (la pantalla): abre `http://localhost:8080/`
- **Mandos**: `http://<ip-de-la-máquina>:8080/pad.html` — el servidor imprime las URL al arrancar, y
  la consola las enseña como QR.

Deja tus juegos en la carpeta `roms/`, o apunta la variable de entorno `ROMS_EXTRA` a otra carpeta.

La consola exige pulsar **Empezar**: los navegadores bloquean el audio hasta que el usuario
interactúa con la página.

Los mandos tienen que estar en la misma red que la máquina. Sin el hotspot de la app, la latencia
depende de tu router: por el de casa se midieron 85,9 ms de ida frente a los 19,9 ms del hotspot.

Para probar la interfaz en el otro idioma sin cambiar el del sistema, añade `?idioma=en` o
`?idioma=es` a la URL.

---

## Compilar la app de Android

Necesita el SDK de Android (lo más cómodo es instalar Android Studio, que lo trae) y un móvil con la
depuración USB activada.

```sh
cd android
./gradlew :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

`local.properties` apunta al SDK de cada máquina y no se versiona. Si falta, créalo con:

```
sdk.dir=C:/Users/tu-usuario/AppData/Local/Android/Sdk
```

Con barras normales: en un fichero `.properties` las contrabarras son escapes, y una ruta con `\U`
revienta con un críptico «Invalid file path».

Detalle de cómo está montada la app —el hotspot, cómo lee las ROMs, las trampas que salieron por el
camino— en [`android/README.md`](android/README.md).

---

## Compilar la app de escritorio

Necesita [Node.js](https://nodejs.org) 18 o posterior.

```sh
cd desktop
npm install
npm start          # arranca sin empaquetar, para desarrollar
npm run dist       # genera el instalador en paquete/desktop/
```

`npm start` usa la `web/` y la `roms/` del propio repositorio, así que lo que
toques se ve al recargar (F5).

### Cómo está montada

El servidor **no corre junto a la ventana**, sino en un proceso aparte
(`utilityProcess` de Electron). Hace su E/S de disco de forma síncrona —recorrer
una carpeta de juegos son cientos de llamadas bloqueantes—, y ahí congelaría la
interfaz. Con 6000 ficheros tarda 161 ms sin que la ventana se entere.

De paso queda como en Android y por el mismo motivo: quien sirve no tiene
ventana, así que cuando hace falta el selector de carpetas se lo pide a quien sí
la tiene.

```
main.js  ──{arrancar}──►  servidor-proceso.js
         ◄──{listo|error}─
         ◄──{pedir-carpeta}─      (el host ha pulsado el botón)
         ──{carpeta}──►           (reindexa y difunde el catálogo)
```

La ventana carga `http://127.0.0.1` y habla con el servidor por el mismo
WebSocket que usaría cualquier navegador: sin precarga, sin IPC y sin una sola
API de Electron al alcance de la página. `web/` sigue sin saber quién le sirve.

### Lo que el escritorio tiene y el móvil no

En `127.0.0.1` sí hay contexto seguro, así que con las cabeceras `COOP`/`COEP`
el navegador expone `SharedArrayBuffer` y EmulatorJS puede usar los **núcleos
con hilos**. Se anuncia como una capacidad más, y solo si están los ficheros de
las cuatro variantes de todos los núcleos: pedir hilos cuando falta uno no
degrada, **aborta el juego** (`emulator.js:535`).

### Al empaquetar

- **`web/` y `server-node/` van junto al ejecutable, no dentro del asar.** Los
  patrones de `files` de electron-builder no salen del directorio de la
  aplicación, y así además `../server-node/servidor.js` resuelve igual
  empaquetado que en desarrollo, porque `app.asar/..` es esa misma carpeta.
- **`ws` se nombra como origen aparte**: electron-builder descarta cualquier
  `node_modules` que encuentre recorriendo un recurso extra.
- **`roms/` no se empaqueta.** El proyecto no distribuye juegos, y copiar la
  carpeta de quien compila metería sus ROMs en el instalador. La app crea la
  carpeta vacía al primer arranque.
- **No hay firma de código**, así que SmartScreen dirá «editor desconocido» la
  primera vez que alguien ejecute el instalador. Un certificado cuesta dinero y
  esto es un proyecto de comunidad.

### El cortafuegos

Es el mayor riesgo de la versión de escritorio. Windows pregunta por el acceso a
la red al primer arranque y marca solo «redes privadas»; un hotspot de móvil
suele clasificarse como pública. Si se deniega, la consola funciona
perfectamente en `127.0.0.1` y **ningún teléfono llega jamás** — un QR que abre
una página que no carga, indistinguible de un fallo del programa.

No se puede consultar la regla sin ser administrador, así que se deduce por
ausencia: consola abierta, 45 segundos y ni un mando. Solo cuentan los mandos de
**otros dispositivos**: uno abierto en un navegador de este mismo equipo entra
por el bucle local sin tocar la red y no prueba nada.

---

## Termux, en un móvil sin instalar la app

**Esto fue la prueba de concepto, no un producto.** Fue como se demostró que la idea funcionaba
antes de que existiera la app de Android, y se mantiene porque sigue sirviendo para desarrollar
directamente sobre el móvil. Si solo quieres jugar, instala la app.

1. Instala **Termux** desde [F-Droid](https://f-droid.org/packages/com.termux/) o desde GitHub
   Releases: la versión de Play Store está abandonada y no sirve.
2. `pkg install nodejs`
3. Copia el proyecto y `cd server-node && npm i ws`
4. Ajustes → Aplicaciones → Termux → Batería → **Sin restricciones**, o Android matará el servidor
   en cuanto salgas de la aplicación.
5. `termux-setup-storage` una vez, para que Termux vea `~/storage/shared`. Sin eso, la carpeta de
   juegos del almacenamiento normal del móvil no existe.
6. `termux-wake-lock && node server.js`
7. Activa el hotspot del móvil y conecta los mandos a esa red.

`scripts/arrancar.sh` y `scripts/parar.sh` están pensados para un acceso directo de Termux:Widget,
de modo que encender la consola sea un solo gesto.

---

## Medir la latencia

El mando enseña en su barra superior dos números, y la consola los repite todos en su superposición
de diagnóstico:

- **`ida p95`** — la mitad del RTT mando ↔ servidor. **Es el número que decide**: el criterio del
  proyecto es que esté por debajo de 30 ms.
- **`rtt`** — ida y vuelta media hasta el servidor.
- **`host`** — ida y vuelta completa: mando → servidor → navegador de la consola → vuelta. Si este
  número se dispara pero `rtt` no, el problema está dentro del dispositivo host y no en el WiFi.

---

## Cosas que conviene saber antes de tocar el código

**`web/` no sabe quién le sirve.** Es la regla que sostiene todo lo demás: ni una línea de esa
carpeta menciona Node, Android ni Electron. Es lo que permite que la misma interfaz corra bajo el
servidor de desarrollo, dentro del APK y dentro de la app de escritorio sin ninguna variante. Si
algo necesita saber quién sirve, se resuelve preguntándoselo al servidor (`capacidades` en el
saludo), no ramificando en el cliente.

**El único fichero acoplado al emulador es `web/js/input-bus.js`.** Cambiar de emulador debería ser
reescribir ese fichero y nada más.

**Por el protocolo viajan códigos, nunca frases.** El servidor no sabe en qué idioma está el
dispositivo que va a enseñar el mensaje —el host y cada mando pueden ir en idiomas distintos—, así
que el texto lo elige siempre quien lo pinta.

**Los textos de la interfaz van por clave.** Lo escrito en el HTML se marca con `data-i18n`; lo que
se construye desde JavaScript llama a `t()`. Añadir un idioma es copiar `web/js/idiomas/es.js`,
traducirlo y listarlo en `web/js/i18n.js`.

**Las mayúsculas de la interfaz son estilo**, y van en CSS con `text-transform`. Escribirlas en el
fuente obliga al traductor a decidirlas idioma por idioma.

---

## EmulatorJS

Está vendorizado en `web/vendor/emulatorjs/` (v4.2.3, GPL-3.0, con su propio `LICENSE`), y no
descargado en tiempo de ejecución: la consola tiene que funcionar sin internet. Se incluyen a mano
algunas piezas que no vienen en la fuente del tag:

- `data/emulator.min.js` y `.min.css`, sin los cuales EmulatorJS cae a un modo de emergencia que
  descarga desde su CDN.
- Las cuatro variantes de cada núcleo (normal, `legacy`, `thread`, `thread-legacy`). Elige una u otra
  según haya WebGL2 y SharedArrayBuffer; sobre HTTP plano, que no es contexto seguro, usa la
  `legacy`.
- `data/cores/reports/*.json`, necesarios para la caché de núcleos.

Verificado con DevTools: sirviendo desde una IP de LAN no hace ni una petición externa. Solo en
`localhost` pide `cdn.emulatorjs.org/stable/data/version.json` para comprobar actualizaciones; sin
internet falla sin bloquear nada.

Su gamepad virtual se desactiva con `EJS_defaultOptions = { 'virtual-gamepad': 'disabled' }`, y su
barra de menú con una regla CSS: la opción `menu-bar-button: hidden` no basta, porque es un ajuste
por defecto que el usuario puede revertir y que EmulatorJS recuerda.

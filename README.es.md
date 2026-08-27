# tiki_emu

**Convierte un móvil Android viejo en una consola retro. Los móviles de tus invitados son los
mandos, y no instalan nada.**

*[Read this in English](README.md)*

El móvil host hace de consola: enseña el juego, ejecuta el emulador y crea su propia red WiFi. Los
demás escanean un QR y su móvil se convierte en un mando dentro del navegador. Sin app que
instalar, sin cuentas y sin conexión a internet.

```
   ┌─────────────────┐
   │   móvil host    │   pantalla + servidor + emulador
   │   (o un PC)     │   crea su propia red WiFi
   └────────┬────────┘
            │  WiFi (no hace falta internet)
      ┌─────┴─────┐
      ▼           ▼
  ┌───────┐   ┌───────┐
  │ móvil │   │ móvil │   mandos, en el navegador
  └───────┘   └───────┘
```

---

## Por qué

Todo el mundo tiene un cajón con un móvil viejo dentro. Tiene una pantalla decente, batería, WiFi y
más potencia que cualquier consola de la época de la que vienen estos juegos. No vale la pena
venderlo y tirarlo es un desperdicio.

La otra mitad de la idea son los invitados. En cuanto una quedada exige que todos *se instalen
algo*, media mesa se cae. Un QR y un navegador no tienen ese coste: escaneas, eliges puesto y
juegas. La gracia es una consola que cabe en un bolsillo y se monta en cualquier sitio en menos de
un minuto —la mesa de un bar, un banco del parque, una habitación de hotel— sin router, sin cables
y sin cuentas.

Es un proyecto para la comunidad. No es, ni va a ser, un producto comercial.

> ### Dos jugadores, no cuatro
>
> Ningún emulador web disponible hoy permite conectar más de dos mandos: ninguno expone la
> asignación de un multitap a un puerto de la consola. Está medido, no supuesto: se probaron varios
> emuladores y varios caminos antes de aceptarlo. El protocolo se diseñó para cuatro puestos; solo
> dos son utilizables, así que solo se enseñan dos.

---

## Qué hace falta

- **Un dispositivo host**: un móvil Android (Android 8 o posterior), o cualquier PC o portátil.
- **Los móviles de los jugadores**: cualquiera con navegador. No instalan nada.
- **Tus juegos**: este repositorio **no incluye ninguna ROM ni BIOS** — ver [Nota legal](#nota-legal).

Nadie necesita conexión a internet, ni siquiera el host.

---

## Instalación

### En un móvil Android

1. Descarga el **`tiki_emu.apk`** más reciente de
   [Releases](https://github.com/rnkr69/tiki_emu/releases) y ábrelo en el móvil. Android te pedirá
   permiso para instalar desde fuera de Play Store: es normal en una app que se distribuye así.
2. Abre la app y concédele el permiso para **crear una red WiFi**. Es lo que permite que la consola
   funcione en cualquier sitio, sin router y sin datos.

Ya está. No hay nada más que configurar.

### En un PC o portátil

Descarga el instalador para tu sistema de
[Releases](https://github.com/rnkr69/tiki_emu/releases), ejecútalo y abre la aplicación.

> **Versión 0.1.0, en pruebas.** Las dos aplicaciones funcionan, pero todavía no ha jugado con ellas
> casi nadie. Si vienes a probarlas, hay una guía con lo que conviene mirar y con los avisos que va a
> dar Windows: [`PRUEBAS.md`](PRUEBAS.md).
>
> Para arrancar desde el código, [`DESARROLLO.md`](DESARROLLO.md).

---

## Jugar

1. **Pon tus juegos en el dispositivo.** En un móvil, conéctalo por USB a un ordenador y arrastra
   una carpeta de ROMs; lo habitual es `/sdcard/Roms`. Luego, en el lobby, «Carpeta de juegos» abre
   el selector del sistema: apúntalo ahí y queda recordado.

2. **Tus invitados escanean dos QR**, en este orden:
   - el primero conecta su móvil a la red WiFi de la consola;
   - el segundo abre el mando en su navegador.

   Los invitados no instalan nada. El mando *es* la página web.

3. **Cada invitado elige puesto** (jugador 1 o 2) y gira el móvil en horizontal.

4. **Elige juego en la consola y dale a Empezar.** El jugador 1 tiene además Guardar y Cargar en su
   mando, y una pantalla de Sala para liberar un puesto si alguien se va.

**Sobre el nombre de la red.** Android crea una red temporal cuyo nombre y contraseña cambian en
cada arranque (`AndroidShare_5195`, `AndroidShare_2775`…). Por eso el QR es imprescindible: nadie va
a teclear una contraseña nueva cada tarde. **Desde Android 16** la app puede ponerle nombre ella
misma, y la red se llama `tiki_emu`. Si el fabricante capa el hotspot o deniegas el permiso no se
rompe nada: la consola sigue con la red a la que ya esté conectado el móvil, y lo avisa en el lobby.

> **Con un router funciona, pero con el hotspot propio de la consola va mucho mejor.** Medido sobre
> hardware real: por el hotspot, la latencia de ida es de **19,9 ms en el percentil 95**. Por el
> router de casa sube a **85,9 ms**, que es la diferencia entre un juego que responde bien y uno que
> no.

---

## Añadir juegos

La consola lee una carpeta y deduce a qué sistema pertenece cada fichero por su extensión, o por el
nombre de la carpeta en los `.zip`. Con organizarlos así basta:

```
Roms/
  nes/
  snes/
  gb/
  gba/
  megadrive/
```

Sistemas soportados: **NES**, **SNES**, **Game Boy / Color / Advance** y **Mega Drive**. El listado
enseña el nombre de la consola, no el del núcleo que la emula: «SNES» dice algo y «snes9x» no.

---

## Idiomas

La interfaz está en **español e inglés**, y **cada dispositivo va en el suyo**: el host y los mandos
son móviles distintos, de personas distintas, así que un invitado con el móvil en inglés ve su mando
en inglés aunque la consola esté en español. Se detecta del navegador; con `?idioma=en` o
`?idioma=es` en la URL se fuerza uno.

Añadir un idioma es copiar `web/js/idiomas/es.js`, traducirlo y listarlo en `web/js/i18n.js`.

---

## Cómo está hecho

Tres piezas, y la frontera entre ellas es el fondo del diseño:

- **`web/`** — la pantalla de la consola, el mando y la página del emulador. **No sabe quién le está
  sirviendo.** Ni una línea menciona Node ni Android. Eso es lo que permite que la misma interfaz
  corra bajo un servidor de desarrollo en un PC y dentro de la app nativa sin tocar nada; la
  compilación de Android copia la carpeta a sus assets tal cual.
- **`server-node/`** — el servidor de desarrollo: estáticos, catálogo de juegos y relay de entrada.
  Una dependencia, `ws`.
- **`android/`** — la app nativa: un servidor Ktor dentro de un servicio en primer plano, un WebView
  a pantalla completa y la red WiFi.

### El protocolo

Dos canales WebSocket, separados a propósito:

- **Un canal de control en JSON** para lo que pasa de vez en cuando: reclamar puesto, la lista de
  puestos, expulsar, guardar y cargar, pings.
- **Un canal binario de 4 bytes para la entrada**: puesto, máscara de botones y número de secuencia.
  La entrada viaja decenas de veces por segundo y no paga ni parseo de JSON, ni reservas de memoria,
  ni garantías de orden que no necesita: un paquete que llega tarde se descarta por su número de
  secuencia, porque un botón desactualizado es peor que un botón que falta.

Por el protocolo no viaja nunca una frase, solo códigos. El servidor no sabe en qué idioma está el
dispositivo que va a enseñar el mensaje, así que el texto lo elige siempre quien lo pinta.

### Tecnologías

| Pieza | Elección | Por qué |
|---|---|---|
| Emulación | [EmulatorJS](https://emulatorjs.org) 4.2.3 (GPL-3.0), vendorizado | Ejecuta núcleos de libretro (`fceumm`, `snes9x`, `mgba`, `genesis_plus_gx`) en el navegador, sin trabajo en el servidor |
| Interfaz | HTML/CSS/JS a pelo, módulos ES nativos | Sin bundler, sin paso de compilación y sin `node_modules` en el camino crítico. Tiene que funcionar sin internet |
| Servidor | Node.js + `ws` | Una sola dependencia. Sirve tanto para desarrollar como dentro de la app de escritorio |
| App de Android | Kotlin + [Ktor](https://ktor.io) en un `ForegroundService` | Un servidor HTTP/WebSocket embebido que sobrevive a que se apague la pantalla |
| App de escritorio | [Electron](https://electronjs.org) | Reutiliza el mismo servidor Node y la misma interfaz, y se instala como cualquier programa |
| Red | `startLocalOnlyHotspot()` | Una red temporal sin salida a internet, que es justo lo que se quiere: el móvil host no necesita datos |
| Juegos | Storage Access Framework | El usuario elige la carpeta; la app nunca pide acceso a todo el almacenamiento |

El mando es una sola superficie multitáctil, no un conjunto de botones: la cruceta deduce la
dirección de dónde está el pulgar respecto al centro, que es lo que permite las diagonales. La
realimentación visual se dispara con el evento táctil local y no espera nunca a la red — esperar
*sería* la latencia.

### Estructura

```
web/          la interfaz. Inmutable entre fases: no menciona ni Node ni Android
server-node/  servidor de desarrollo. Solo depende de ws
android/      app nativa de Android (Kotlin + Ktor)
desktop/      app de escritorio con Electron
roms/         tus juegos (no se distribuyen — ver Nota legal)
```

Compilar cualquiera de las dos, y el servidor de desarrollo, están en
[`DESARROLLO.md`](DESARROLLO.md).

---

## Estado

Funcionando y probado sobre hardware real: el protocolo con puestos y tokens, el mando multitáctil,
el emparejamiento por QR, el lobby en vivo, la reconexión, la expulsión, el diagnóstico de latencia
en pantalla, el selector de juegos, guardar y cargar desde el mando, y la app nativa de Android con
su propia red WiFi.

También la app de escritorio, que se instala en un PC como cualquier otro programa y aprovecha algo
que en el móvil no se puede: al servirse desde el propio equipo, el emulador puede usar sus núcleos
con hilos.

Sin publicar todavía: las compilaciones de ninguna de las dos. Sacar la primera versión es el
siguiente paso. Falta también probar la de escritorio con teléfonos de verdad como mandos: hasta
ahora se ha probado el servidor, no la red.

La documentación de trabajo —especificación, planes, mediciones— se mantiene aparte y no forma parte
de este repositorio.

---

## Nota legal

Este repositorio **no distribuye ROMs ni BIOS comerciales**, y la app de Android tampoco lleva
ninguna dentro. Poner tus propios juegos, y la legalidad de hacerlo donde vivas, es responsabilidad
de quien lo haga.

## Licencia

**GPL-3.0** — ver [`LICENSE`](LICENSE).

No es solo una preferencia. EmulatorJS y los núcleos de libretro que ejecuta son GPL, así que
cualquier cosa que los incluya —el APK de Android, un futuro instalable de escritorio— hereda esa
licencia de todas formas. Aquí se asume de buen grado: el proyecto existe para la comunidad.

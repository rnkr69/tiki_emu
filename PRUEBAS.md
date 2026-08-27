# Guía para probar tiki_emu

*[Read this in English](TESTING.md)*

Gracias por prestarte. Esto todavía no ha jugado nadie que no sea quien lo ha
escrito, así que lo que encuentres es información nueva, incluido «no he
conseguido pasar del segundo paso».

**Lo que necesitas:** un PC con Windows o un móvil Android para hacer de
consola, otro móvil cualquiera para hacer de mando, y algún juego tuyo.

---

## Antes de empezar: los juegos

**No van incluidos y no te los podemos pasar.** El proyecto no distribuye ROMs;
tienes que poner las tuyas. Sirven ficheros de NES, SNES, Game Boy, Game Boy
Color, Game Boy Advance y Mega Drive.

Déjalos en una carpeta, con subcarpetas si quieres. Si tienes `.zip`, mételos en
una carpeta con el nombre de la consola (`nes`, `snes`, `gb`, `gbc`, `gba`,
`megadrive`), que es de donde se deduce a qué máquina pertenecen.

---

## En un PC con Windows

1. Ejecuta `tiki_emu-0.1.0-instalador.exe`.

2. **Windows va a decir que no conoce el programa.** Sale una pantalla azul de
   «Windows protegió tu PC»: *Más información* → *Ejecutar de todas formas*. No
   está firmado, y firmarlo cuesta dinero que este proyecto no tiene. Es
   esperable, pero si prefieres no hacerlo, lo entendemos perfectamente.

3. Se instala solo para tu usuario, sin pedir permisos de administrador.

4. Al abrirlo, **Windows preguntará por el acceso a la red**. Aquí hay que
   fijarse: marca **las dos casillas, privadas y públicas**. Si dices que no, la
   consola se verá bien en tu pantalla pero **ningún móvil podrá conectarse**, y
   el síntoma es confuso: el QR abre una página que se queda cargando.

5. En la consola, **Juegos → Elegir carpeta de juegos** y apunta a donde tengas
   las ROMs.

## En un móvil Android

1. Instala `tiki_emu-0.1.0.apk`. Android pedirá permiso para instalar de fuera
   de Play Store.
2. Ábrelo y **concede el permiso para crear una red WiFi**: es lo que hace que
   funcione sin router.
3. Pasa tus juegos al móvil por USB, a `Almacenamiento interno → Roms`, y luego
   **Carpeta de juegos** en el lobby.

---

## Jugar

1. Los invitados escanean **los dos QR, en orden**: el primero conecta su móvil
   a la red, el segundo abre el mando.
2. Cada uno elige puesto (1 o 2) y gira el móvil en horizontal.
3. Eliges juego en la consola y le das a Empezar.

Son **dos jugadores como máximo**. No es un descuido: ningún emulador web
permite hoy conectar más.

---

## Qué nos vendría bien que mires

No hace falta que lo hagas todo. Lo de arriba es lo importante.

**Que funcione lo básico**

- ¿Llegaste a jugar? ¿En qué paso te atascaste, si te atascaste?
- ¿Aparecieron tus juegos en el listado, con el nombre de la consola correcto?
- ¿Arrancó el juego? Prueba **más de un sistema** si puedes: NES, SNES y GBA
  usan emuladores distintos y pueden fallar por separado.

**Los mandos, que es lo menos probado**

- ¿Se conectó el segundo móvil? ¿Qué modelo y qué versión de Android o iOS?
- **¿Se nota retraso al pulsar?** Es la pregunta más importante del proyecto. El
  mando enseña arriba unos números en milisegundos: si puedes, dinos cuáles ves
  jugando. Por debajo de 30 debería ir fino.
- ¿Se apagó la pantalla del móvil a media partida?
- ¿Se cayó algún mando y volvió solo?

**Cosas que sospechamos**

- **En PC**: si el QR apunta a una dirección por la que tu móvil no llega. Si
  tienes VPN, Docker o máquinas virtuales, es un buen sitio donde mirar.
- **En PC**: si tras 45 segundos sin que conecte ningún mando aparece un aviso
  hablando del cortafuegos, cuéntanos si lo que decía te sirvió de algo.
- **En Android**: el nombre de la red que crea la consola. Por debajo de Android
  16 lo pone el sistema (`AndroidShare_...`) y no se puede cambiar.
- Si el móvil que hace de mando **no es un Android reciente**, cualquier cosa
  rara. En iPhone la pantalla completa no se puede forzar y hay una pantalla de
  «gira el móvil» que hace de sustituta.

**Cómo se ve**

- ¿Cabe todo en la pantalla de tu móvil sin cortarse? Interesan sobre todo las
  pantallas muy alargadas y las tablets.
- Si tu móvil está en inglés, la interfaz debería salir en inglés. Y cada
  dispositivo va en su idioma: la consola en uno y un mando en otro es
  correcto, no un fallo.

---

## Cómo contarlo

Con un mensaje vale. Si puedes, incluye:

- **Qué dispositivos**: modelo y sistema de la consola y de los mandos.
- **Qué esperabas y qué pasó.** Una captura o un vídeo del móvil vale más que
  una descripción.
- Si algo se rompió del todo, en qué paso exacto fue.

Y si algo te resultó confuso aunque acabara funcionando, dilo también: eso es
tan útil como un fallo. Si has tenido que preguntar cómo se hace algo, es que
falta explicarlo.

---

## Lo que ya sabemos que falta

Para que no gastes tiempo en ello:

- No hay firma de código, de ahí el aviso de Windows.
- Solo dos jugadores.
- La versión de escritorio **no se ha probado nunca con un móvil de verdad como
  mando**. Es literalmente para lo que estás aquí.
- No hay macOS ni Linux.
- Las partidas guardadas las guarda el emulador en el navegador de la consola:
  si cambias de dispositivo, no se llevan.

// El servidor de la consola: estáticos, catálogo de juegos y relay de entrada.
//
// Es una fábrica y no un script porque hay dos formas de arrancarlo: `server.js`
// desde la línea de órdenes, y la app de escritorio, que lo importa dentro de un
// proceso de Electron. Lo que cambia entre las dos son rutas, cabeceras y quién
// sabe abrir un selector de carpetas; todo eso entra por parámetro.
//
// Única dependencia de runtime: `ws`. Esta restricción existe para que la
// traducción a Ktor de la app de Android sea mecánica. No añadir express ni
// similares.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { WebSocketServer } from 'ws';
import { Sala } from './rooms.js';

// --- Tablas: no dependen de ninguna instancia --------------------------------

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.data': 'application/octet-stream',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.nes': 'application/octet-stream',
  '.sfc': 'application/octet-stream',
  '.smc': 'application/octet-stream',
  '.gb': 'application/octet-stream',
  '.gba': 'application/octet-stream',
  '.md': 'application/octet-stream',
  '.bin': 'application/octet-stream',
  '.zip': 'application/zip'
};

/**
 * Extensiones que sabemos mapear a un núcleo. La correspondencia vive aquí
 * porque depende de qué hay en disco, y viaja al cliente en el listado: así
 * `web/` no tiene que conocer el sistema de ficheros de nadie.
 */
const NUCLEOS = {
  '.nes': 'fceumm',
  '.fds': 'fceumm',
  '.sfc': 'snes9x',
  '.smc': 'snes9x',
  '.gb': 'mgba',
  '.gbc': 'mgba',
  '.gba': 'mgba',
  '.md': 'genesis_plus_gx',
  '.gen': 'genesis_plus_gx',
  '.smd': 'genesis_plus_gx',
  '.zip': null   // el núcleo se deduce de la carpeta que lo contiene
};

/** Para los .zip, que no dicen nada por su extensión. */
const NUCLEO_POR_CARPETA = {
  nes: 'fceumm', snes: 'snes9x', gb: 'mgba',
  gbc: 'mgba', gba: 'mgba', megadrive: 'genesis_plus_gx'
};

/**
 * Nombre de la consola, que es lo que el catálogo enseña. El núcleo («fceumm»,
 * «mgba») no le dice nada a nadie, y además uno solo cubre varias consolas: por
 * eso el sistema se deduce de la extensión y no del núcleo.
 */
const SISTEMAS = {
  '.nes': 'NES',
  '.fds': 'NES',
  '.sfc': 'SNES',
  '.smc': 'SNES',
  '.gb': 'GAME BOY',
  '.gbc': 'GBC',
  '.gba': 'GBA',
  '.md': 'MEGA DRIVE',
  '.gen': 'MEGA DRIVE',
  '.smd': 'MEGA DRIVE'
};

const SISTEMA_POR_CARPETA = {
  nes: 'NES', snes: 'SNES', gb: 'GAME BOY',
  gbc: 'GBC', gba: 'GBA', megadrive: 'MEGA DRIVE'
};

/**
 * Topes del recorrido de carpetas. Alguien va a apuntar el selector a la raíz
 * de un disco: eso debe degradar, no colgarse. Son los mismos que usa la app de
 * Android en Biblioteca.kt.
 */
const PROFUNDIDAD_MAX = 4;
const MAX_FICHEROS = 5000;

/**
 * Documentación que no es un juego. Hace falta porque `.md` es a la vez Mega
 * Drive y Markdown: sin esto, el README de la carpeta de juegos aparece en el
 * catálogo como un juego de Mega Drive que no arranca.
 */
const NO_SON_JUEGOS = /^(readme|leeme|léeme|changelog|license|licencia|notas)$/i;

// --- Índice de juegos --------------------------------------------------------

/**
 * Recorre una carpeta y devuelve sus juegos, con la ruta real de cada uno.
 *
 * Recorrido con pila explícita y no con recursión, para que la profundidad del
 * árbol no se traduzca en profundidad de llamadas.
 */
function explorar(raiz, prefijo) {
  const encontrados = [];
  if (!raiz) return encontrados;

  const pila = [[raiz, prefijo, 0]];
  while (pila.length && encontrados.length < MAX_FICHEROS) {
    const [dir, url, nivel] = pila.pop();
    let entradas;
    try {
      entradas = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;   // carpeta ilegible: se salta, no se aborta el resto
    }

    for (const entrada of entradas) {
      if (entrada.name.startsWith('.')) continue;
      const ruta = path.join(dir, entrada.name);
      const urlHija = `${url}/${entrada.name}`;

      if (entrada.isDirectory()) {
        if (nivel < PROFUNDIDAD_MAX) pila.push([ruta, urlHija, nivel + 1]);
        continue;
      }

      const ext = path.extname(entrada.name).toLowerCase();
      if (!(ext in NUCLEOS)) continue;
      if (NO_SON_JUEGOS.test(entrada.name.slice(0, -ext.length))) continue;
      const carpeta = path.basename(dir).toLowerCase();
      const nucleo = NUCLEOS[ext] || NUCLEO_POR_CARPETA[carpeta];
      if (!nucleo) continue;

      let tamano = 0;
      try {
        tamano = fs.statSync(ruta).size;
      } catch {
        continue;   // desapareció entre el listado y el stat
      }

      encontrados.push({
        clave: urlHija,
        ruta,
        entrada: {
          nombre: entrada.name.replace(/\.[^.]+$/, '').replace(/[_.]/g, ' ').trim(),
          // Se codifica tramo a tramo para no destrozar las barras: los nombres
          // traen espacios, paréntesis y acentos.
          url: urlHija.split('/').map(encodeURIComponent).join('/'),
          nucleo,
          sistema: SISTEMAS[ext] || SISTEMA_POR_CARPETA[carpeta] || '',
          tamano
        }
      });
      if (encontrados.length >= MAX_FICHEROS) break;
    }
  }
  return encontrados;
}

/** Si una dirección es la de este mismo equipo. */
function esBucleLocal(ip = '') {
  // Node entrega las IPv4 en forma mapeada a IPv6 cuando se escucha en ambas.
  const limpia = ip.replace(/^::ffff:/, '');
  return limpia === '127.0.0.1' || limpia === '::1' || limpia.startsWith('127.');
}

// --- Direcciones de red ------------------------------------------------------

/**
 * Adaptadores que no llevan a ninguna parte útil. En un móvil no existen, pero
 * un PC va lleno: WSL, Docker, VirtualBox y las VPN publican IPv4 privadas que
 * puntúan igual que el WiFi de verdad, y el QR acabaría apuntando a una red por
 * la que no llega ningún teléfono.
 */
const ADAPTADORES_VIRTUALES =
  /^(vEthernet|Loopback|Bluetooth)|VirtualBox|VMware|Hyper-V|Npcap|TAP-|Docker|ZeroTier|Tailscale/i;

/** IPv4 no internas, para saber qué URL dar a los mandos. */
export function direccionesLocales() {
  const salida = [];
  for (const [nombre, lista] of Object.entries(os.networkInterfaces())) {
    if (ADAPTADORES_VIRTUALES.test(nombre)) continue;
    for (const info of lista || []) {
      if (info.family !== 'IPv4' || info.internal) continue;
      // 169.254.x.x es lo que se asigna un equipo cuando no hay DHCP: está
      // garantizado que nadie llega por ahí.
      if (info.address.startsWith('169.254.')) continue;
      salida.push([nombre, info.address]);
    }
  }
  return salida.sort(([, a], [, b]) => prioridadRed(b) - prioridadRed(a));
}

/**
 * Cuanto más se parezca a «la red que ha montado la consola», más arriba. Se
 * comprueban los rangos privados de verdad y no prefijos de texto: `172.` a
 * secas también captura 172.200.x, que es espacio público.
 */
export function prioridadRed(ip) {
  const o = ip.split('.').map(Number);
  // Hotspot del propio dispositivo: Android reparte 192.168.43.x y Windows
  // 192.168.137.x. Es el escenario para el que se diseñó la consola.
  if (ip.startsWith('192.168.43.') || ip.startsWith('192.168.137.')) return 4;
  if (o[0] === 192 && o[1] === 168) return 3;
  if (o[0] === 10) return 2;
  if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return 1;
  return 0;
}

// --- La fábrica --------------------------------------------------------------

/**
 * @param {object} opciones
 * @param {number} opciones.puerto
 * @param {string} opciones.web            carpeta con la interfaz
 * @param {string|null} opciones.roms      juegos que acompañan al programa
 * @param {string|null} opciones.romsExtra carpeta del usuario, si la hay
 * @param {object} opciones.cabecerasExtra cabeceras añadidas a toda respuesta
 * @param {Function} opciones.registrar    (codigo, url) por cada petición
 * @param {Function|null} opciones.alPedirCarpeta el host pide el selector; si no
 *   se pasa, la capacidad no se anuncia y el lobby no enseña el botón
 * @param {Function} opciones.alConectarMando  ha entrado un mando. Recibe si la
 *   conexión viene de otro dispositivo, que es la única prueba de que la red
 *   deja pasar — en un PC eso no se puede dar por hecho
 */
export function crearServidor({
  puerto = 8080,
  web,
  roms = null,
  romsExtra = null,
  cabecerasExtra = {},
  registrar = () => {},
  alPedirCarpeta = null,
  alConectarMando = () => {}
} = {}) {
  if (!web) throw new Error('crearServidor: falta la carpeta web');

  let carpetaExtra = romsExtra;

  /**
   * Índice de juegos: clave de URL a fichero real.
   *
   * Es un mapa y no una resolución de rutas a propósito. Como nunca se
   * concatena lo que pide el cliente con una ruta del sistema, escaparse con
   * `../` deja de ser posible por construcción, no por una comprobación que hay
   * que acertar. Importa más aquí que en el móvil, porque en el PC el usuario
   * apunta a carpetas arbitrarias. Es lo que hace Biblioteca.kt.
   */
  let indice = new Map();
  let catalogo = [];

  /**
   * Reconstruye el índice entero y lo cambia de una vez. Nunca se muta el que
   * está publicado: una petición en vuelo no puede encontrarse medio índice.
   */
  function reindexar() {
    const nuevoIndice = new Map();
    const nuevoCatalogo = [];
    for (const [raiz, prefijo] of [[roms, '/roms'], [carpetaExtra, '/roms-ext']]) {
      for (const { clave, ruta, entrada } of explorar(raiz, prefijo)) {
        nuevoIndice.set(clave, { ruta, tamano: entrada.tamano });
        nuevoCatalogo.push(entrada);
      }
    }
    indice = nuevoIndice;
    catalogo = nuevoCatalogo;
    // Sin ordenar: el orden alfabético depende del idioma de quien mira, así
    // que lo decide el cliente, que es el único que sabe cuál es.
  }
  reindexar();

  // --- Estáticos -------------------------------------------------------------

  /** Resuelve una URL a un fichero de `web/`, o null. */
  function resolverWeb(limpio) {
    const raizServida = path.resolve(web);
    let destino = path.resolve(
      raizServida,
      limpio === '/' || limpio === '' ? 'index.html' : `.${path.sep}${limpio}`
    );
    // Impide escapar del directorio servido con ../
    if (destino !== raizServida && !destino.startsWith(raizServida + path.sep)) return null;
    try {
      if (fs.statSync(destino).isDirectory()) destino = path.join(destino, 'index.html');
    } catch {
      return null;
    }
    return destino;
  }

  /**
   * Único sitio donde se escriben cabeceras. Estaba repartido en tres
   * `writeHead` sin nada en común, y con las cabeceras de aislamiento puestas
   * en dos de los tres acabas con un `crossOriginIsolated` en false sin saber
   * por qué.
   */
  function responder(res, codigo, cabeceras) {
    res.writeHead(codigo, { ...cabeceras, ...cabecerasExtra });
  }

  function noEncontrado(res, url) {
    // Se registra: en el móvil no hay DevTools a mano y un 404 aquí es la
    // explicación más rápida de «he pulsado y no pasa nada».
    registrar(404, url);
    responder(res, 404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('No encontrado');
  }

  /**
   * Sirve un fichero, atendiendo peticiones por rango. EmulatorJS las usa con
   * las ROMs grandes, y sin `Accept-Ranges` pide el fichero entero cada vez.
   */
  function servirFichero(req, res, ruta, tamano, url) {
    const tipo = TIPOS[path.extname(ruta).toLowerCase()] || 'application/octet-stream';
    const rango = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');

    let inicio = 0;
    let fin = tamano - 1;
    if (rango) {
      // `bytes=-500` son los últimos 500, no del 0 al 500.
      if (rango[1] === '') {
        inicio = Math.max(0, tamano - Number(rango[2]));
      } else {
        inicio = Number(rango[1]);
        if (rango[2] !== '') fin = Math.min(fin, Number(rango[2]));
      }
      if (!Number.isFinite(inicio) || inicio > fin || inicio >= tamano) {
        responder(res, 416, { 'content-range': `bytes */${tamano}` });
        res.end();
        return;
      }
    }

    registrar(rango ? 206 : 200, url);
    responder(res, rango ? 206 : 200, {
      'content-type': tipo,
      'content-length': fin - inicio + 1,
      'accept-ranges': 'bytes',
      ...(rango ? { 'content-range': `bytes ${inicio}-${fin}/${tamano}` } : {}),
      // Sin caché: en desarrollo estorba más de lo que ayuda.
      'cache-control': 'no-store'
    });

    const flujo = fs.createReadStream(ruta, { start: inicio, end: fin });
    // Un fallo de lectura a media respuesta no puede tumbar el proceso: la
    // cabecera ya salió, así que lo único que queda es cortar.
    flujo.on('error', () => res.destroy());
    res.on('close', () => flujo.destroy());
    flujo.pipe(res);
  }

  const servidor = http.createServer((req, res) => {
    let limpio;
    try {
      limpio = decodeURIComponent((req.url || '/').split('?')[0]);
    } catch {
      return noEncontrado(res, req.url);   // porcentaje mal formado
    }

    // Catálogo de juegos (HU-15). Es parte del contrato con `web/`, no una
    // filtración de Node: la app de Android lo sirve con el mismo formato.
    if (limpio === '/api/roms') {
      registrar(200, limpio);
      responder(res, 200, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store'
      });
      res.end(JSON.stringify(catalogo));
      return;
    }

    // Los juegos salen del índice, nunca de resolver una ruta.
    if (limpio.startsWith('/roms/') || limpio.startsWith('/roms-ext/')) {
      const juego = indice.get(limpio);
      if (!juego) return noEncontrado(res, limpio);
      return servirFichero(req, res, juego.ruta, juego.tamano, limpio);
    }

    const fichero = resolverWeb(limpio);
    if (!fichero) return noEncontrado(res, limpio);
    let tamano;
    try {
      tamano = fs.statSync(fichero).size;
    } catch {
      return noEncontrado(res, limpio);
    }
    servirFichero(req, res, fichero, tamano, limpio);
  });

  // --- WebSocket -------------------------------------------------------------

  const wss = new WebSocketServer({ server: servidor });
  const sala = new Sala();

  let host = null;          // conexión del host (la pantalla)
  const pads = new Set();   // conexiones de mandos

  function enviar(ws, obj) {
    if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
  }

  /** Manda el estado de los slots a todo el mundo: host y mandos. */
  function difundirSlots() {
    const mensaje = { t: 'slots', slots: sala.listaSlots() };
    enviar(host, mensaje);
    for (const pad of pads) enviar(pad, mensaje);
  }

  /** Avisa al host de que el catálogo ha cambiado; él lo vuelve a pedir. */
  function difundirCatalogo() {
    enviar(host, { t: 'catalogo' });
  }

  let siguienteId = 1;

  wss.on('connection', (ws, peticion) => {
    ws.rol = null;
    // Un mando abierto en un navegador de este mismo equipo llega por el bucle
    // local y no demuestra que la red deje pasar a nadie de fuera. Se distingue
    // aquí, que es donde se sabe.
    ws.remoto = !esBucleLocal(peticion.socket.remoteAddress);
    ws.slot = null;
    ws.token = null;
    ws.id = siguienteId++;   // identifica la conexión para enrutar el eco

    ws.on('message', (data, esBinario) => {
      if (esBinario) {
        // Canal de entrada. El servidor no interpreta la máscara: solo reenvía.
        // Sobrescribe el byte 0 con el slot asociado al token de esta conexión,
        // para que un mando no pueda suplantar a otro (§6.2).
        if (ws.rol !== 'pad' || !ws.slot) return;
        if (!host || host.readyState !== host.OPEN) return;
        if (data.length !== 4) return;
        const paquete = Buffer.from(data);
        paquete[0] = ws.slot;
        host.send(paquete, { binary: true });
        return;
      }

      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }

      switch (msg.t) {
        case 'hello':
          if (msg.role === 'host') {
            host = ws;
            ws.rol = 'host';
            registrar(null, '[ws] host conectado');
            // Las direcciones van en el saludo porque el host se sirve en
            // 127.0.0.1 y desde ahí no puede saber por qué IP le alcanzan los
            // mandos: eso solo lo sabe quien escucha. Es parte del contrato, no
            // una filtración de Node; la app de Android lo dice igual.
            enviar(ws, {
              t: 'welcome',
              role: 'host',
              slots: sala.listaSlots(),
              direcciones: direccionesLocales().map(([nombre, ip]) => ({ nombre, ip, puerto })),
              // Lo que sabe hacer quien sirve. El lobby enseña solo lo que
              // tenga sentido donde esté corriendo.
              capacidades: {
                elegirCarpeta: Boolean(alPedirCarpeta),
                hilos: hayNucleosConHilos()
              }
            });
          } else {
            ws.rol = 'pad';
            pads.add(ws);
            alConectarMando(ws.remoto);
            // Un token conocido recupera su slot sin pasar por la selección; uno
            // nuevo entra sin slot y tendrá que reclamar.
            const previo = msg.token && sala.slotDe(msg.token);
            ws.token = previo ? msg.token : sala.crearToken();
            if (previo) {
              sala.reclamar(previo, ws.token);
              ws.slot = previo;
            }
            registrar(null, `[ws] mando conectado (${pads.size} en total)${previo ? ` recupera slot ${previo}` : ''}`);
            enviar(ws, {
              t: 'welcome',
              role: 'pad',
              token: ws.token,
              slot: ws.slot,
              slots: sala.listaSlots()
            });
            if (previo) difundirSlots();
          }
          break;

        case 'claim': {
          if (ws.rol !== 'pad') return;
          if (sala.llena && !sala.slotDe(ws.token)) {
            enviar(ws, { t: 'error', code: 'ROOM_FULL', slots: sala.listaSlots() });
            return;
          }
          const res = sala.reclamar(msg.slot, ws.token);
          if (!res.ok) {
            // Se devuelve la lista actualizada para que el mando pueda volver a
            // elegir sin esperar otro mensaje (HU-07).
            enviar(ws, { t: 'error', code: res.code, slots: sala.listaSlots() });
            return;
          }
          ws.slot = res.slot;
          enviar(ws, { t: 'claimed', slot: res.slot });
          difundirSlots();
          registrar(null, `[ws] slot ${res.slot} reclamado`);
          break;
        }

        case 'kick': {
          // Solo el jugador 1 puede echar a otro, y nunca a sí mismo (HU-10).
          // El host también puede, por si el slot 1 es el que se ha colgado.
          const esJugador1 = ws.rol === 'pad' && ws.slot === 1;
          if (!esJugador1 && ws.rol !== 'host') return;
          if (msg.slot === ws.slot) return;

          const victima = [...pads].find((p) => p.slot === msg.slot);
          sala.expulsar(msg.slot);
          if (victima) {
            victima.slot = null;
            victima.token = null;
            enviar(victima, { t: 'kicked' });
          }
          difundirSlots();
          registrar(null, `[sala] slot ${msg.slot} expulsado`);
          break;
        }

        case 'release':
          if (ws.rol !== 'pad' || !ws.token) return;
          sala.soltar(ws.token);
          ws.slot = null;
          enviar(ws, { t: 'claimed', slot: null });
          difundirSlots();
          break;

        case 'ping':
          // Devuelve el ts del cliente sin tocar: mide el RTT mando <-> servidor
          // con un único reloj, el del propio mando.
          enviar(ws, { t: 'pong', ts: msg.ts });
          break;

        case 'hotkey':
          // Acciones que no son botones del juego: guardar, cargar. Solo el
          // jugador 1, y el servidor no las interpreta, solo las reenvía (§6.3).
          if (ws.rol !== 'pad' || ws.slot !== 1) return;
          enviar(host, { t: 'hotkey', id: msg.id, slot: ws.slot });
          break;

        case 'elegir-carpeta':
          // Solo el host: un mando no abre diálogos en el ordenador de nadie.
          // Quien sirve no siempre tiene ventana —en Android vive en un
          // servicio, aquí en otro proceso—, así que se lo pide a quien la tiene.
          if (ws.rol !== 'host') return;
          alPedirCarpeta?.();
          break;

        case 'stats':
          // El mando publica su latencia y el host la pinta: así el diagnóstico
          // se ve en la pantalla grande, sin pedirle nada al invitado (HU-17).
          if (ws.rol !== 'pad' || !ws.slot) return;
          enviar(host, { t: 'stats', slot: ws.slot, ...msg.datos });
          break;

        case 'echo':
          // Sonda de ida y vuelta completa mando -> servidor -> host -> vuelta.
          // Aísla cuánto cuesta el salto local hasta el navegador del host.
          if (ws.rol === 'pad') {
            // Sin host no hay nada que medir. Se ignora en silencio: es una
            // sonda automática, no una acción del jugador.
            if (host && host.readyState === host.OPEN) {
              // El eco viaja con el id del mando que lo originó. Sin eso, con
              // dos mandos sondeando a la vez las respuestas se cruzan y cada
              // uno acaba restando contra el reloj del otro: los relojes de dos
              // navegadores no tienen el mismo origen y salen tiempos absurdos.
              enviar(host, { t: 'echo', ts: msg.ts, id: ws.id });
            }
          } else if (ws.rol === 'host') {
            const origen = [...pads].find((p) => p.id === msg.id);
            if (origen) enviar(origen, { t: 'echo-pong', ts: msg.ts });
          }
          break;
      }
    });

    ws.on('close', () => {
      if (ws === host) {
        host = null;
        registrar(null, '[ws] host desconectado');
      }
      if (pads.delete(ws)) {
        // El slot no se libera de inmediato: queda reservado un rato por si el
        // mando vuelve tras un bloqueo de pantalla.
        if (ws.token && sala.slotDe(ws.token)) {
          sala.desconectar(ws.token);
          difundirSlots();
        }
        registrar(null, `[ws] mando desconectado (${pads.size} restantes)`);
      }
    });
  });

  // Barrido de reservas vencidas: un slot cuyo mando no ha vuelto en 30 segundos
  // se libera para que otro pueda cogerlo.
  const barrido = setInterval(() => {
    const liberados = sala.limpiarCaducados();
    if (liberados.length) {
      registrar(null, `[sala] slots liberados por inactividad: ${liberados.join(', ')}`);
      difundirSlots();
    }
  }, 5000);
  // Que este temporizador no sea motivo para que el proceso siga vivo.
  barrido.unref?.();

  /**
   * Si se pueden ofrecer los núcleos con hilos. Hacen falta dos cosas a la vez,
   * y anunciarlos sin una de ellas es peor que no anunciarlos:
   *
   *   · Las cabeceras de aislamiento, sin las cuales el navegador no expone
   *     SharedArrayBuffer y EmulatorJS **aborta el juego** en vez de tirar sin
   *     hilos (`emulator.js:535`). Por eso no basta con que estén los ficheros:
   *     sirviendo por HTTP plano a la red local esto tiene que dar false.
   *   · Las cuatro variantes de todos los núcleos. EmulatorJS elige la suya al
   *     vuelo según el equipo, y si le falta el fichero el juego no arranca.
   */
  function hayNucleosConHilos() {
    const c = Object.fromEntries(
      Object.entries(cabecerasExtra).map(([k, v]) => [k.toLowerCase(), v])
    );
    if (c['cross-origin-opener-policy'] !== 'same-origin') return false;
    if (c['cross-origin-embedder-policy'] !== 'require-corp') return false;

    const cores = path.join(web, 'vendor', 'emulatorjs', 'data', 'cores');
    const nucleos = [...new Set(Object.values(NUCLEOS).filter(Boolean))];
    return nucleos.every((n) =>
      fs.existsSync(path.join(cores, `${n}-thread-wasm.data`)) &&
      fs.existsSync(path.join(cores, `${n}-thread-legacy-wasm.data`))
    );
  }

  return {
    /**
     * Arranca. Rechaza si el puerto está ocupado, en vez de dejar que un evento
     * `error` sin escuchar tumbe el proceso: dentro de Electron eso sería una
     * ventana que se cierra sin explicación.
     */
    escuchar() {
      return new Promise((resolve, reject) => {
        // Hay que escuchar en los dos: `ws` reemite en su propia instancia el
        // error del servidor HTTP, y ese segundo evento, sin nadie que lo
        // atienda, tumba el proceso aunque el primero sí esté recogido.
        const fallo = (e) => { wss.off('error', fallo); reject(e); };
        servidor.once('error', fallo);
        wss.once('error', fallo);

        // Explícitamente en todas las interfaces: escuchar solo en 127.0.0.1
        // da el mismo síntoma que un cortafuegos cerrado —la consola va, los
        // mandos no llegan— y no conviene poder confundir las dos cosas.
        servidor.listen(puerto, '0.0.0.0', () => {
          servidor.off('error', fallo);
          wss.off('error', fallo);
          // A partir de aquí un error ya no impide arrancar, pero tampoco debe
          // matar el proceso: se anota y se sigue.
          servidor.on('error', (e) => registrar(null, `[http] error: ${e.message}`));
          wss.on('error', (e) => registrar(null, `[ws] error: ${e.message}`));
          resolve(puerto);
        });
      });
    },

    /** Cierra todo y libera el puerto. */
    cerrar() {
      return new Promise((resolve) => {
        clearInterval(barrido);
        for (const cliente of wss.clients) cliente.close(1001);
        wss.close();
        servidor.close(() => resolve());
        // Un socket ascendido a WebSocket no cuenta como petición en curso y
        // dejaría el cierre esperando para siempre.
        servidor.closeAllConnections?.();
        setTimeout(resolve, 2000).unref?.();
      });
    },

    /** Cambia la carpeta de juegos del usuario y reconstruye el índice. */
    fijarRomsExtra(ruta) {
      carpetaExtra = ruta || null;
      reindexar();
    },

    /** Vuelve a explorar sin cambiar de carpeta. */
    reindexar,
    difundirCatalogo,
    direcciones: () => direccionesLocales().map(([nombre, ip]) => ({ nombre, ip, puerto })),
    get juegos() { return catalogo.length; }
  };
}

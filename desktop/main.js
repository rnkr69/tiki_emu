// tiki_emu de escritorio.
//
// La misma consola, con el ordenador como pantalla. Cambia quién sirve los
// ficheros y quién abre la ventana; `web/` no se entera, igual que no se entera
// en Android. Esta ventana carga http://127.0.0.1 y habla con el servidor por
// el mismo WebSocket que usaría cualquier navegador: no hay precarga, ni IPC,
// ni una sola API de Electron al alcance de la página.

import { app, BrowserWindow, Menu, dialog, shell, powerSaveBlocker, utilityProcess } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { crearAjustes } from './ajustes.js';
import { textosPara } from './textos.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const EMPAQUETADO = app.isPackaged;

// Empaquetada, la interfaz y los juegos van junto al ejecutable y no dentro del
// asar: un asar es de solo lectura, así que ahí nadie podría dejar un juego, y
// los núcleos del emulador se leen mejor del disco que de dentro de un archivo.
const WEB = EMPAQUETADO
  ? path.join(process.resourcesPath, 'web')
  : path.join(AQUI, '..', 'web');
const ROMS = EMPAQUETADO
  ? path.join(process.resourcesPath, 'roms')
  : path.join(AQUI, '..', 'roms');

const PUERTO_BASE = 8080;
const INTENTOS_DE_PUERTO = 10;

/** Aviso del cortafuegos: se espera esto antes de sospechar (§ el cortafuegos). */
const ESPERA_ANTES_DE_SOSPECHAR = 45_000;

const ajustes = crearAjustes(app.getPath('userData'));
const textos = textosPara(app.getLocale());

let ventana = null;
let servidor = null;        // el proceso hijo
let puertoEnUso = PUERTO_BASE;
let bloqueoDeSuspension = null;
let cerrando = false;
let avisoPendiente = null;

// --- Servidor ----------------------------------------------------------------

/**
 * Arranca el servidor y devuelve el puerto. Si el 8080 está ocupado —otra copia
 * abierta, o cualquier otro programa— se prueban los siguientes en vez de
 * rendirse: quien juega no tiene por qué saber qué es un puerto.
 */
function arrancarServidor() {
  return new Promise((resolve, reject) => {
    servidor = utilityProcess.fork(path.join(AQUI, 'servidor-proceso.js'));
    let intento = 0;

    servidor.on('message', (msg) => {
      switch (msg.t) {
        case 'listo':
          resolve(msg.puerto);
          break;

        case 'error':
          if (msg.codigo === 'EADDRINUSE' && intento < INTENTOS_DE_PUERTO) {
            pedirArranque(PUERTO_BASE + ++intento);
          } else {
            reject(new Error(msg.mensaje));
          }
          break;

        case 'pedir-carpeta':
          elegirCarpeta();
          break;

        case 'log':
          // Solo en desarrollo: en un paquete no hay consola donde mirarlo.
          if (!EMPAQUETADO) console.log(msg.texto);
          break;

        case 'mando':
          // Solo cuenta un mando de otro dispositivo: uno abierto en un
          // navegador de este mismo equipo entra por el bucle local sin tocar
          // la red, así que no prueba que el cortafuegos deje pasar a nadie.
          if (!msg.remoto) break;
          clearTimeout(avisoPendiente);
          if (!ajustes.get('mandoHaConectado')) ajustes.set('mandoHaConectado', true);
          break;
      }
    });

    servidor.on('exit', () => {
      if (cerrando) return;
      // Si el servidor se cae solo, la ventana se queda con un lobby que no va
      // a conectar nunca. Mejor decirlo que dejar una consola muda.
      dialog.showErrorBox(textos.errorTitulo, textos.errorServidor);
      app.exit(1);
    });

    pedirArranque(PUERTO_BASE);

    function pedirArranque(puerto) {
      puertoEnUso = puerto;
      servidor.postMessage({
        t: 'arrancar',
        puerto,
        web: WEB,
        roms: ROMS,
        romsExtra: ajustes.get('carpetaJuegos')
      });
    }
  });
}

// --- Carpeta de juegos -------------------------------------------------------

async function elegirCarpeta() {
  const { canceled, filePaths } = await dialog.showOpenDialog(ventana, {
    title: textos.elegirCarpeta,
    defaultPath: ajustes.get('carpetaJuegos') || app.getPath('home'),
    properties: ['openDirectory']
  });
  if (canceled || !filePaths[0]) return;

  ajustes.set('carpetaJuegos', filePaths[0]);
  servidor?.postMessage({ t: 'carpeta', ruta: filePaths[0] });
}

/** Abre en el explorador la carpeta donde dejar los juegos. */
function abrirCarpeta() {
  const carpeta = ajustes.get('carpetaJuegos') || ROMS;
  fs.mkdirSync(carpeta, { recursive: true });
  shell.openPath(carpeta);
}

// --- El cortafuegos ----------------------------------------------------------

/**
 * Windows pregunta por el acceso a la red la primera vez, marca solo «redes
 * privadas», y un hotspot de móvil suele clasificarse como pública. Si se dice
 * que no, la consola funciona perfectamente en 127.0.0.1 y **ningún teléfono
 * llega jamás**: el síntoma es un QR que abre una página que no carga, que es
 * indistinguible de un fallo del programa.
 *
 * No se puede preguntar al sistema si la regla existe sin permisos de
 * administrador, así que se deduce por ausencia: hay consola abierta, ha pasado
 * un rato largo y no ha entrado ni un mando.
 */
function vigilarCortafuegos() {
  if (process.platform !== 'win32') return;
  // En una instalación donde ya ha jugado alguien, esto no vuelve a aparecer.
  if (ajustes.get('mandoHaConectado')) return;

  avisoPendiente = setTimeout(() => explicarLaRed(false), ESPERA_ANTES_DE_SOSPECHAR);
}

async function explicarLaRed(aPeticion) {
  if (!ventana) return;
  const { response } = await dialog.showMessageBox(ventana, {
    type: aPeticion ? 'info' : 'warning',
    title: textos.redTitulo,
    message: aPeticion ? textos.redComoConectar : textos.redNadieConecta,
    detail: textos.redDetalle,
    buttons: [textos.redAbrirFirewall, textos.entendido],
    defaultId: 1,
    cancelId: 1,
    noLink: true
  });
  if (response === 0) shell.openExternal('ms-settings:windowsdefender');
}

// --- Ventana y menú ----------------------------------------------------------

function crearVentana(puerto) {
  const guardada = ajustes.get('ventana');

  ventana = new BrowserWindow({
    width: guardada.ancho,
    height: guardada.alto,
    minWidth: 640,
    minHeight: 400,
    // El mismo negro del fondo de la consola: sin esto se ve un destello blanco
    // al abrir, que en una interfaz oscura canta mucho.
    backgroundColor: '#06060c',
    show: false,
    title: 'tiki_emu',
    icon: path.join(AQUI, 'recursos', 'icono.ico'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  if (guardada.maximizada) ventana.maximize();

  ventana.loadURL(`http://127.0.0.1:${puerto}/`);
  ventana.once('ready-to-show', () => ventana.show());

  // La consola no es un navegador: de aquí no se sale. Lo que sea externo se
  // abre en el navegador de verdad, y navegar fuera del origen local no ocurre.
  const esLocal = (url) => url.startsWith(`http://127.0.0.1:${puerto}`);
  ventana.webContents.setWindowOpenHandler(({ url }) => {
    if (!esLocal(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  ventana.webContents.on('will-navigate', (ev, url) => {
    if (!esLocal(url)) ev.preventDefault();
  });

  ventana.on('close', () => {
    // Se guarda el tamaño normal, no el de la pantalla completa: al reabrir,
    // restaurar una ventana del tamaño exacto del monitor confunde.
    if (!ventana.isMaximized() && !ventana.isFullScreen()) {
      const [ancho, alto] = ventana.getSize();
      ajustes.set('ventana', { ancho, alto, maximizada: false });
    } else if (ventana.isMaximized()) {
      ajustes.set('ventana', { ...ajustes.get('ventana'), maximizada: true });
    }
  });

  ventana.on('closed', () => { ventana = null; });
}

function construirMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: textos.menuConsola,
      submenu: [
        { role: 'togglefullscreen', label: textos.pantallaCompleta },
        { role: 'reload', label: textos.recargar, accelerator: 'F5' },
        { type: 'separator' },
        { role: 'quit', label: textos.salir }
      ]
    },
    {
      label: textos.menuJuegos,
      submenu: [
        { label: textos.elegirCarpeta, click: elegirCarpeta },
        { label: textos.abrirCarpeta, click: abrirCarpeta },
        { label: textos.volverAExplorar, click: () => servidor?.postMessage({ t: 'reindexar' }) }
      ]
    },
    {
      label: textos.menuAyuda,
      submenu: [
        { label: textos.redComoConectar, click: () => explicarLaRed(true) },
        { label: textos.acercaDe, click: acercaDe },
        // Las herramientas de desarrollo siguen a mano, pero no en el menú: no
        // son parte de lo que se le ofrece a quien viene a jugar.
        {
          label: 'DevTools',
          accelerator: 'CmdOrCtrl+Shift+I',
          visible: false,
          click: () => ventana?.webContents.toggleDevTools()
        }
      ]
    }
  ]));
}

function acercaDe() {
  dialog.showMessageBox(ventana, {
    type: 'info',
    title: textos.acercaDe,
    message: `tiki_emu ${app.getVersion()}`,
    detail: textos.acercaDetalle,
    buttons: [textos.entendido]
  });
}

// --- Ciclo de vida -----------------------------------------------------------

// Una sola consola por equipo: dos ventanas servirían dos servidores en puertos
// distintos y los QR de una no valdrían para la otra.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!ventana) return;
    if (ventana.isMinimized()) ventana.restore();
    ventana.focus();
  });

  app.whenReady().then(async () => {
    // El instalador no trae juegos —el proyecto no distribuye ROMs—, así que la
    // carpeta se crea aquí: mejor que exista y esté vacía a que «abrir la
    // carpeta de juegos» no lleve a ninguna parte.
    try {
      fs.mkdirSync(ROMS, { recursive: true });
    } catch {
      /* si no se puede, se juega igual desde la carpeta que elija el usuario */
    }

    let puerto;
    try {
      puerto = await arrancarServidor();
    } catch (e) {
      dialog.showErrorBox(textos.errorTitulo, `${textos.errorArranque}\n\n${e.message}`);
      app.exit(1);
      return;
    }

    construirMenu();
    crearVentana(puerto);
    vigilarCortafuegos();

    // Que no se apague la pantalla a media partida. En el móvil esto se resuelve
    // con NoSleep.js desde la propia web; aquí hay una vía nativa, y
    // `prevent-app-suspension` no basta: deja que la pantalla se apague igual.
    bloqueoDeSuspension = powerSaveBlocker.start('prevent-display-sleep');
  });

  app.on('window-all-closed', () => app.quit());

  app.on('before-quit', (ev) => {
    if (cerrando) return;
    // Se aplaza la salida para cerrar el servidor a conciencia: si no, el
    // proceso hijo puede quedar reteniendo el puerto y la siguiente partida
    // arrancaría en el 8081 sin motivo aparente.
    ev.preventDefault();
    cerrando = true;
    clearTimeout(avisoPendiente);
    if (powerSaveBlocker.isStarted(bloqueoDeSuspension)) {
      powerSaveBlocker.stop(bloqueoDeSuspension);
    }

    let salida = false;
    const salir = () => { if (!salida) { salida = true; app.exit(0); } };
    servidor?.once('exit', salir);
    servidor?.postMessage({ t: 'cerrar' });
    // Y si no contesta, se sale igualmente: nadie espera a que un programa
    // cerrado termine de cerrarse.
    setTimeout(salir, 2000);
  });
}

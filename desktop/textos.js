// Textos del menú y de los diálogos.
//
// Son de Electron, no de `web/`, así que no pasan por el sistema de traducción
// de la interfaz (`web/js/i18n.js`): un menú nativo se construye antes de que
// exista ninguna página. Son pocos y no van a crecer, así que dos objetos
// literales antes que montar un segundo mecanismo de idiomas.

const ES = {
  menuConsola: 'Consola',
  menuJuegos: 'Juegos',
  menuAyuda: 'Ayuda',

  pantallaCompleta: 'Pantalla completa',
  recargar: 'Recargar',
  salir: 'Salir',

  elegirCarpeta: 'Elegir carpeta de juegos…',
  abrirCarpeta: 'Abrir la carpeta de juegos',
  volverAExplorar: 'Volver a explorar',

  acercaDe: 'Acerca de tiki_emu',
  acercaDetalle:
    'Una consola retro donde los móviles de tus invitados son los mandos.\n\n' +
    'Software libre bajo licencia GPL-3.0.',

  entendido: 'Entendido',

  redTitulo: 'Conectar los mandos',
  redComoConectar: 'Cómo conectar el mando',
  redNadieConecta: 'Todavía no ha conectado ningún mando',
  redDetalle:
    'Los mandos son los móviles de quienes juegan: se conectan a esta consola ' +
    'por la red, escaneando el código QR.\n\n' +
    'Si al abrir la consola Windows preguntó por el acceso a la red y se ' +
    'respondió que no, los teléfonos no pueden llegar hasta aquí, aunque la ' +
    'consola se vea bien en esta pantalla. También ocurre si la red está ' +
    'marcada como pública, que es lo habitual al conectarse al hotspot de un ' +
    'móvil.\n\n' +
    'Se corrige permitiendo tiki_emu en el cortafuegos, para redes privadas y ' +
    'públicas.',
  redAbrirFirewall: 'Abrir el cortafuegos',

  errorTitulo: 'tiki_emu',
  errorArranque: 'No se pudo arrancar la consola.',
  errorServidor: 'La consola ha dejado de responder y va a cerrarse.'
};

const EN = {
  menuConsola: 'Console',
  menuJuegos: 'Games',
  menuAyuda: 'Help',

  pantallaCompleta: 'Full screen',
  recargar: 'Reload',
  salir: 'Quit',

  elegirCarpeta: 'Choose games folder…',
  abrirCarpeta: 'Open games folder',
  volverAExplorar: 'Scan again',

  acercaDe: 'About tiki_emu',
  acercaDetalle:
    "A retro console where your guests' phones are the controllers.\n\n" +
    'Free software under the GPL-3.0 licence.',

  entendido: 'Got it',

  redTitulo: 'Connecting controllers',
  redComoConectar: 'How to connect a controller',
  redNadieConecta: 'No controller has connected yet',
  redDetalle:
    "Controllers are your guests' phones: they reach this console over the " +
    'network by scanning the QR code.\n\n' +
    'If Windows asked about network access when the console started and the ' +
    'answer was no, phones cannot reach it — even though the console looks ' +
    'fine on this screen. The same happens when the network is marked as ' +
    "public, which is usual when joining a phone's hotspot.\n\n" +
    'To fix it, allow tiki_emu through the firewall, on both private and ' +
    'public networks.',
  redAbrirFirewall: 'Open firewall settings',

  errorTitulo: 'tiki_emu',
  errorArranque: 'The console could not start.',
  errorServidor: 'The console stopped responding and will close.'
};

/** @param {string} idioma el de `app.getLocale()` */
export function textosPara(idioma) {
  return String(idioma).startsWith('es') ? ES : EN;
}

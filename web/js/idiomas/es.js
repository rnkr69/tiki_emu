// Español: el idioma fuente. Es el que se escribe primero y del que salen las
// traducciones, así que también hace de red de seguridad cuando falta una clave
// en otro idioma.
//
// Convención: ambito.componente.elemento. Los códigos del protocolo van
// literales como último tramo (error.SLOT_TAKEN) para poder componer la clave
// con t('error.' + codigo).

export const es = {
  // --- Páginas ---
  'titulo.consola': 'Consola',
  'titulo.mando': 'Mando',
  'titulo.juego': 'Juego',

  // --- Lobby: conectar mandos ---
  'lobby.red.conecta': 'Conecta tu móvil a esta red',
  'lobby.red.sinClave': 'sin contraseña',
  'lobby.red.fallo': '{motivo}. Conecta los mandos a la misma red que este móvil.',
  'lobby.mando.abre': 'Abre el mando en tu móvil',
  'lobby.acciones.elegirJuego': 'Elegir juego',

  // --- Lobby: elegir juego ---
  'lobby.juegos.buscarEtiqueta': 'Buscar juego',
  'lobby.juegos.buscar': 'Buscar juego…',
  'lobby.juegos.vacio': 'No hay juegos',
  'lobby.juegos.vacioCarpeta': 'No hay juegos: elige la carpeta donde los tengas',
  'lobby.juegos.sinFiltro': 'Ningún juego con ese nombre',
  'lobby.juegos.sinCatalogo': 'No se pudo leer el catálogo',
  'lobby.juegos.mas': 'y {n} más: escribe para filtrar',
  'lobby.acciones.mandos': 'Mandos',
  'lobby.acciones.carpeta': 'Carpeta de juegos',
  'lobby.acciones.seguir': 'Seguir jugando',
  'lobby.acciones.empezar': 'Empezar',

  // --- Puestos, vistos desde el host ---
  'lobby.puesto.libre': 'Libre',
  'lobby.puesto.listo': 'Listo',
  'lobby.puesto.reconectando': 'Reconectando',

  // --- Partida ---
  'partida.menu': 'Menú',
  'partida.volver': 'Volver al lobby',
  'partida.reiniciar': 'Reiniciar juego',
  'partida.guardada': 'Partida guardada',
  'partida.cargada': 'Partida cargada',
  'partida.sinArrancar': 'La consola no ha arrancado',

  // --- Mando: elegir puesto ---
  'mando.slots.titulo': 'Elige puesto',
  'mando.slots.libre': 'Libre',
  'mando.slots.ocupado': 'Ocupado',
  'mando.slots.reservado': 'Reservado',

  // --- Mando: gira el móvil ---
  'mando.gira.titulo': 'Gira el móvil',
  'mando.gira.texto': 'El mando se sujeta en horizontal, con las dos manos.',
  'mando.gira.puesto': 'Tu puesto sigue guardado',

  // --- Mando: controles ---
  'mando.cruceta': 'Cruceta',
  'mando.barra.jugador': 'Jugador {n}',
  'mando.guardar': 'Guardar',
  'mando.cargar': 'Cargar',
  'mando.confirmar': '¿Seguro?',
  'mando.sala': 'Sala',

  // --- Mando: sala (jugador 1) ---
  'mando.sala.titulo': 'Sala',
  'mando.sala.volver': 'Volver al mando',
  'mando.sala.sacar': 'Sacar',
  'mando.sala.otraVez': 'Toca otra vez',
  'mando.sala.confirma': 'Toca otra vez para confirmar.',
  'mando.sala.liberado': 'Puesto {n} liberado.',

  // --- Mando: estados ---
  'mando.estado.reconectando.titulo': 'Reconectando…',
  'mando.estado.reconectando.texto':
    'Se ha perdido la conexión con la consola. Volverá sola en cuanto se recupere.',
  'mando.estado.expulsado.titulo': 'Te han sacado',
  'mando.estado.expulsado.texto': 'El jugador {n} ha liberado tu puesto.',
  'mando.estado.volver': 'Volver a elegir',

  // --- Estado de la conexión ---
  // El valor que viaja por código es fijo; esto es solo su etiqueta.
  'red.estado.conectado': 'conectado',
  'red.estado.desconectado': 'desconectado',
  'red.estado.error': 'error',

  // --- Errores del protocolo ---
  'error.SLOT_TAKEN': 'Ese puesto lo acaba de coger otra persona. Elige otro.',
  'error.ROOM_FULL': 'La sala está completa.',
  'error.NO_HOST': 'La consola no está abierta todavía.',
  'error.BAD_TOKEN': 'Sesión no válida, vuelve a elegir puesto.',
  'error.desconocido': 'Algo ha ido mal ({codigo}).',

  // --- Motivos por los que no se pudo crear la red ---
  'red.error.SIN_CANAL': 'No hay canal WiFi libre',
  'red.error.GENERICO': 'El sistema no ha permitido crear la red',
  'red.error.MODO_INCOMPATIBLE': 'El modo no es compatible en este móvil',
  'red.error.COMPARTICION_BLOQUEADA': 'La compartición de red está bloqueada',
  'red.error.SIN_PERMISO': 'Falta el permiso de red',
  'red.error.WIFI_APAGADO': 'El WiFi está apagado o ya hay una red compartida',
  'red.error.desconocido': 'No se pudo crear la red'
};

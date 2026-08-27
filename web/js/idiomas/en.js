// English. Mirrors es.js key by key; anything missing here falls back to the
// Spanish text rather than showing nothing.

export const en = {
  // --- Pages ---
  'titulo.consola': 'Console',
  'titulo.mando': 'Controller',
  'titulo.juego': 'Game',

  // --- Lobby: connect controllers ---
  'lobby.red.conecta': 'Connect your phone to this network',
  'lobby.red.sinClave': 'no password',
  'lobby.red.fallo': '{motivo}. Connect the controllers to the same network as this phone.',
  'lobby.mando.abre': 'Open the controller on your phone',
  'lobby.acciones.elegirJuego': 'Choose game',

  // --- Lobby: choose game ---
  'lobby.juegos.buscarEtiqueta': 'Search game',
  'lobby.juegos.buscar': 'Search game…',
  'lobby.juegos.vacio': 'No games yet',
  'lobby.juegos.vacioCarpeta': 'No games yet: choose the folder where you keep them',
  'lobby.juegos.sinFiltro': 'No game by that name',
  'lobby.juegos.sinCatalogo': 'Could not read the game list',
  'lobby.juegos.mas': 'and {n} more: type to filter',
  'lobby.acciones.mandos': 'Controllers',
  'lobby.acciones.carpeta': 'Game folder',
  'lobby.acciones.seguir': 'Resume game',
  'lobby.acciones.empezar': 'Start',

  // --- Player slots, as seen on the host ---
  'lobby.puesto.libre': 'Free',
  'lobby.puesto.listo': 'Ready',
  'lobby.puesto.reconectando': 'Reconnecting',

  // --- In game ---
  'partida.menu': 'Menu',
  'partida.volver': 'Back to lobby',
  'partida.reiniciar': 'Restart game',
  'partida.guardada': 'Game saved',
  'partida.cargada': 'Game loaded',
  'partida.sinArrancar': 'The console did not start',

  // --- Controller: choose slot ---
  'mando.slots.titulo': 'Choose your seat',
  'mando.slots.libre': 'Free',
  'mando.slots.ocupado': 'Taken',
  'mando.slots.reservado': 'Held',

  // --- Controller: rotate the phone ---
  'mando.gira.titulo': 'Turn your phone',
  'mando.gira.texto': 'Hold the controller sideways, with both hands.',
  'mando.gira.puesto': 'Your seat is still yours',

  // --- Controller: controls ---
  'mando.cruceta': 'D-pad',
  'mando.barra.jugador': 'Player {n}',
  'mando.guardar': 'Save',
  'mando.cargar': 'Load',
  'mando.confirmar': 'Sure?',
  'mando.sala': 'Room',

  // --- Controller: room (player 1) ---
  'mando.sala.titulo': 'Room',
  'mando.sala.volver': 'Back to controller',
  'mando.sala.sacar': 'Remove',
  'mando.sala.otraVez': 'Tap again',
  'mando.sala.confirma': 'Tap again to confirm.',
  'mando.sala.liberado': 'Seat {n} freed.',

  // --- Controller: states ---
  'mando.estado.reconectando.titulo': 'Reconnecting…',
  'mando.estado.reconectando.texto':
    'Lost connection to the console. It will come back on its own.',
  'mando.estado.expulsado.titulo': 'You were removed',
  'mando.estado.expulsado.texto': 'Player {n} freed your seat.',
  'mando.estado.volver': 'Choose again',

  // --- Connection state ---
  'red.estado.conectado': 'connected',
  'red.estado.desconectado': 'disconnected',
  'red.estado.error': 'error',

  // --- Protocol errors ---
  'error.SLOT_TAKEN': 'Someone just took that seat. Pick another one.',
  'error.ROOM_FULL': 'The room is full.',
  'error.NO_HOST': 'The console is not open yet.',
  'error.BAD_TOKEN': 'Invalid session, choose your seat again.',
  'error.desconocido': 'Something went wrong ({codigo}).',

  // --- Why the network could not be created ---
  'red.error.SIN_CANAL': 'No free WiFi channel',
  'red.error.GENERICO': 'The system would not create the network',
  'red.error.MODO_INCOMPATIBLE': 'This phone does not support that mode',
  'red.error.COMPARTICION_BLOQUEADA': 'Network sharing is blocked',
  'red.error.SIN_PERMISO': 'Missing network permission',
  'red.error.WIFI_APAGADO': 'WiFi is off, or a network is already being shared',
  'red.error.desconocido': 'Could not create the network'
};

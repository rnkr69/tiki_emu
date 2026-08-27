// Capa de inyección: el ÚNICO fichero del sistema acoplado a un emulador concreto.
// Si algún día se cambia a Nostalgist.js, a eventos de teclado sintéticos o a
// RetroArch nativo por UDP, se reescribe este fichero y nada más.
//
// No importar nada de aquí en otros módulos salvo el propio objeto InputBus.

/** Ventana donde vive el emulador. Puede ser esta misma o la de un marco. */
let ventana = window;

export const InputBus = {
  /**
   * Apunta el bus a la ventana donde corre el emulador. El lobby lo lleva en un
   * marco aparte para poder cambiar de juego sin recargarse a sí mismo.
   */
  usarVentana(w) {
    ventana = w || window;
  },

  get _emulador() {
    try {
      return ventana?.EJS_emulator ?? null;
    } catch {
      // Un marco todavía sin cargar puede lanzar al accederle.
      return null;
    }
  },

  /**
   * @param {number} player  slot del jugador, 1-4
   * @param {number} index   índice de botón de libretro
   * @param {boolean} pressed
   */
  set(player, index, pressed) {
    // EmulatorJS numera los jugadores desde 0.
    this._emulador?.gameManager?.simulateInput(player - 1, index, pressed ? 1 : 0);
  },

  /** Pulsación corta, para las acciones que no son botones de juego. */
  hotkey(player, index) {
    this.set(player, index, true);
    setTimeout(() => this.set(player, index, false), 50);
  },

  /** ¿Está el emulador listo para recibir entrada? */
  get listo() {
    return Boolean(this._emulador?.gameManager?.simulateInput);
  }
};

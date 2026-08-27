// Estado de la sala: slots, tokens y reglas de reparto.
//
// Este fichero no sabe nada de WebSockets ni de HTTP: recibe y devuelve datos.
// Esa separación es deliberada — en la Fase 4 el transporte pasa a ser Ktor y
// esta lógica debería poder traducirse casi línea por línea.

/**
 * Puestos de la sala. Son dos porque es el techo de la emulación en navegador
 * (ver docs/paso-0-jugadores.md): el protocolo admite hasta 4 sin cambios, pero
 * ofrecer puestos que el emulador no puede usar solo genera confusión.
 */
export const SLOTS = 2;

/** Cuánto se reserva un slot tras caerse su mando, en milisegundos. */
export const RESERVA_MS = 30000;

export class Sala {
  constructor({ slots = SLOTS } = {}) {
    this.total = slots;
    // slot -> { token, conectado, desdeQue }
    this.ocupacion = new Map();
    // token -> slot
    this.tokens = new Map();
    this.siguienteToken = 1;
  }

  /** Token opaco y no adivinable a ojo, pero sin pretensiones criptográficas. */
  crearToken() {
    const n = this.siguienteToken++;
    return `${n.toString(36)}-${Math.floor(Math.random() * 0xffffff).toString(36)}`;
  }

  /** Estado de los slots tal como viaja en el protocolo (§6.1). */
  listaSlots() {
    const salida = [];
    for (let n = 1; n <= this.total; n++) {
      const info = this.ocupacion.get(n);
      salida.push({ n, taken: Boolean(info), conectado: info ? info.conectado : false });
    }
    return salida;
  }

  /**
   * Reclama un slot para un token.
   * @returns {{ok: true, slot: number} | {ok: false, code: string}}
   */
  reclamar(slot, token) {
    if (!Number.isInteger(slot) || slot < 1 || slot > this.total) {
      return { ok: false, code: 'SLOT_TAKEN' };
    }
    const actual = this.ocupacion.get(slot);
    // Un slot ocupado solo se cede a su propio dueño (reconexión).
    if (actual && actual.token !== token) return { ok: false, code: 'SLOT_TAKEN' };

    // Si este token ya tenía otro slot, lo suelta antes de coger el nuevo.
    const anterior = this.tokens.get(token);
    if (anterior && anterior !== slot) this.ocupacion.delete(anterior);

    this.ocupacion.set(slot, { token, conectado: true, desdeQue: null });
    this.tokens.set(token, slot);
    return { ok: true, slot };
  }

  /** Slot asociado a un token, o null. */
  slotDe(token) {
    return this.tokens.get(token) ?? null;
  }

  /** Libera el slot de un token por voluntad propia. */
  soltar(token) {
    const slot = this.tokens.get(token);
    if (!slot) return null;
    this.ocupacion.delete(slot);
    this.tokens.delete(token);
    return slot;
  }

  /**
   * Libera un slot por decisión ajena: su token deja de valer, para que el
   * expulsado no lo recupere al reconectar (HU-10).
   */
  expulsar(slot) {
    const info = this.ocupacion.get(slot);
    if (!info) return null;
    this.ocupacion.delete(slot);
    this.tokens.delete(info.token);
    return slot;
  }

  /**
   * Marca un mando como caído sin liberar su slot todavía: se reserva para que
   * pueda volver tras un bloqueo de pantalla (HU-09).
   */
  desconectar(token) {
    const slot = this.tokens.get(token);
    if (!slot) return null;
    const info = this.ocupacion.get(slot);
    if (info) {
      info.conectado = false;
      info.desdeQue = Date.now();
    }
    return slot;
  }

  /**
   * Libera los slots cuya reserva ha vencido.
   * @returns {number[]} slots liberados
   */
  limpiarCaducados(ahora = Date.now()) {
    const liberados = [];
    for (const [slot, info] of this.ocupacion) {
      if (!info.conectado && info.desdeQue && ahora - info.desdeQue > RESERVA_MS) {
        this.ocupacion.delete(slot);
        this.tokens.delete(info.token);
        liberados.push(slot);
      }
    }
    return liberados;
  }

  get llena() {
    return this.ocupacion.size >= this.total;
  }
}

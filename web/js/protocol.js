// Codificación y decodificación del canal de entrada binario.
// Paquete de 4 bytes, según §6.2 de la especificación:
//   byte 0 : slot (1-4)
//   byte 1 : máscara de botones, bits 0-7
//   byte 2 : máscara de botones, bits 8-15
//   byte 3 : seq, contador 0-255 que envuelve
//
// Este fichero no conoce ni la red ni el emulador. Solo bytes.

/** Índices de botón de libretro (§6.3). Un bit de la máscara por índice. */
export const BTN = {
  B: 0, Y: 1, SELECT: 2, START: 3,
  UP: 4, DOWN: 5, LEFT: 6, RIGHT: 7,
  A: 8, X: 9, L: 10, R: 11,
  L2: 12, R2: 13, L3: 14, R3: 15
};

/** Índices de hotkey de EmulatorJS. Viajan por el canal de control, no en la máscara. */
export const HOTKEY = {
  SAVE: 24, LOAD: 25, SLOT: 26, FAST_FORWARD: 27, REWIND: 28, SLOW_MOTION: 29
};

/**
 * @param {number} slot 1-4
 * @param {number} mask entero de 16 bits
 * @param {number} seq  0-255
 * @returns {Uint8Array} paquete de 4 bytes
 */
export function encode(slot, mask, seq) {
  const buf = new Uint8Array(4);
  buf[0] = slot & 0xff;
  buf[1] = mask & 0xff;
  buf[2] = (mask >> 8) & 0xff;
  buf[3] = seq & 0xff;
  return buf;
}

/**
 * @param {ArrayBuffer|Uint8Array} data
 * @returns {{slot: number, mask: number, seq: number}|null} null si el tamaño no es 4
 */
export function decode(data) {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (buf.length !== 4) return null;
  return {
    slot: buf[0],
    mask: buf[1] | (buf[2] << 8),
    seq: buf[3]
  };
}

/**
 * ¿Es `seq` posterior al último recibido? Ventana de 128 para gestionar el
 * envolvimiento del contador de 8 bits: la mitad del espacio se considera
 * "futuro" y la otra mitad "pasado".
 *
 * @param {number} seq      secuencia entrante
 * @param {number|null} last última secuencia aceptada, o null si es la primera
 */
export function isNewer(seq, last) {
  if (last === null || last === undefined) return true;
  return ((seq - last) & 0xff) < 128 && seq !== last;
}

/**
 * Bits que han cambiado entre dos máscaras.
 * @returns {Array<{index: number, pressed: boolean}>}
 */
export function diffMask(prev, next) {
  const changed = prev ^ next;
  if (changed === 0) return [];
  const out = [];
  for (let i = 0; i < 16; i++) {
    if (changed & (1 << i)) out.push({ index: i, pressed: (next & (1 << i)) !== 0 });
  }
  return out;
}

/** Intervalo del latido de estado, en milisegundos (§6.2). */
export const HEARTBEAT_MS = 250;

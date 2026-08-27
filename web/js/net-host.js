// Cliente WebSocket del host: recibe paquetes de entrada y los traduce a
// llamadas al InputBus. Descarta paquetes fuera de orden por secuencia.

import { decode, isNewer, diffMask, HOTKEY } from './protocol.js';
import { InputBus } from './input-bus.js';

/** Nombres del canal de control a índices de hotkey del emulador (§6.3). */
const HOTKEYS = {
  save: HOTKEY.SAVE,
  load: HOTKEY.LOAD,
  slot: HOTKEY.SLOT
};

export class NetHost {
  constructor({
    onEstado, onPaquete, onSlots, onStats, onHotkey, onDirecciones, onRed, onCapacidades, onCatalogo
  } = {}) {
    this.ws = null;
    this.onEstado = onEstado || (() => {});
    this.onPaquete = onPaquete || (() => {});
    this.onSlots = onSlots || (() => {});
    this.onStats = onStats || (() => {});
    this.onHotkey = onHotkey || (() => {});
    this.onDirecciones = onDirecciones || (() => {});
    this.onRed = onRed || (() => {});
    this.onCapacidades = onCapacidades || (() => {});
    this.onCatalogo = onCatalogo || (() => {});
    // Estado por slot: última máscara aplicada y última secuencia aceptada.
    this.slots = new Map();
    this.descartados = 0;
    this.reintentos = 0;
  }

  conectar() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${proto}//${location.host}`);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      this.reintentos = 0;
      this.ws.send(JSON.stringify({ t: 'hello', role: 'host' }));
      this.onEstado('conectado');
    };

    this.ws.onmessage = (ev) => {
      if (typeof ev.data === 'string') {
        const msg = JSON.parse(ev.data);
        // El servidor usa al host como espejo para medir el trayecto completo.
        // Se devuelve el id intacto para que el servidor sepa a qué mando
        // corresponde esta ida y vuelta.
        if (msg.t === 'echo') this.ws.send(JSON.stringify({ t: 'echo', ts: msg.ts, id: msg.id }));
        else if (msg.t === 'slots' || (msg.t === 'welcome' && msg.slots)) {
          this.onSlots(msg.slots);
          if (msg.direcciones) this.onDirecciones(msg.direcciones);
          // La red propia solo existe si quien sirve puede crearla; el servidor
          // de la Fase 1 no manda este campo y aquí no pasa nada.
          if (msg.red !== undefined) this.onRed(msg.red);
          // Lo mismo con las capacidades: quien sirve dice qué sabe hacer, y la
          // web enseña solo lo que tenga sentido donde esté corriendo.
          if (msg.capacidades) this.onCapacidades(msg.capacidades);
        }
        else if (msg.t === 'catalogo') this.onCatalogo();
        else if (msg.t === 'red') {
          this.onRed(msg.red);
          // Levantar el hotspot cambia las direcciones: el QR del mando tiene
          // que apuntar a la nueva o los invitados no llegan.
          if (msg.direcciones) this.onDirecciones(msg.direcciones);
        }
        else if (msg.t === 'stats') this.onStats(msg);
        else if (msg.t === 'hotkey') {
          const indice = HOTKEYS[msg.id];
          if (indice !== undefined) {
            InputBus.hotkey(msg.slot, indice);
            this.onHotkey(msg.id);
          }
        }
        return;
      }
      this._entrada(ev.data);
    };

    this.ws.onclose = () => {
      this.onEstado('desconectado');
      // El host también reconecta solo: si se reinicia el servidor a media
      // partida, la consola debe recuperarse sin tocar el móvil (HU-16).
      this.reintentos++;
      const espera = Math.min(5000, 250 * 2 ** Math.min(this.reintentos, 5));
      setTimeout(() => this.conectar(), espera);
    };
    this.ws.onerror = () => this.onEstado('error');
  }

  /**
   * Pide a quien sirve que abra su selector de carpetas. Solo lo atenderá si ha
   * anunciado esa capacidad; aquí no se sabe —ni hace falta saber— cómo lo hace.
   */
  elegirCarpeta() {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ t: 'elegir-carpeta' }));
  }

  _entrada(buffer) {
    const paquete = decode(buffer);
    if (!paquete) return;

    let estado = this.slots.get(paquete.slot);
    if (!estado) {
      estado = { mask: 0, seq: null };
      this.slots.set(paquete.slot, estado);
    }

    if (!isNewer(paquete.seq, estado.seq)) {
      // Un latido repite la secuencia anterior sin cambios: no es un descarte real.
      if (paquete.seq !== estado.seq) {
        this.descartados++;
      }
      return;
    }
    estado.seq = paquete.seq;

    for (const { index, pressed } of diffMask(estado.mask, paquete.mask)) {
      InputBus.set(paquete.slot, index, pressed);
    }
    estado.mask = paquete.mask;
    this.onPaquete(paquete);
  }
}

// Cliente WebSocket del mando.
// No sabe quién le está sirviendo: la URL sale de location.host.

import { encode, HEARTBEAT_MS } from './protocol.js';
import { Latencia } from './latency.js';

// Cada cuánto se sondea la latencia. Importa más de lo que parece: con sondas
// muy espaciadas la radio WiFi del móvil entra en reposo entre una y otra, y
// cada sonda paga el coste de despertarla (decenas de milisegundos). Eso no es
// la latencia de juego, porque jugando hay tráfico continuo y la radio no
// duerme. Se sondea a 50 ms para reproducir esa condición.
// Con ?ping=500 en la URL se puede volver al sondeo espaciado y comparar: la
// diferencia entre ambos es, precisamente, el coste del ahorro de energía.
const PING_MS = Number(new URLSearchParams(location.search).get('ping')) || 50;

/** Clave del token en sessionStorage. Nunca localStorage (§10). */
const CLAVE_TOKEN = 'consola.token';

export class NetPad {
  constructor({ onEstado, onSlots, onClaim, onError, onKicked } = {}) {
    this.ws = null;
    this.slot = null;
    this.token = sessionStorage.getItem(CLAVE_TOKEN) || null;
    this.mask = 0;
    this.seq = 0;
    this.onEstado = onEstado || (() => {});
    this.onSlots = onSlots || (() => {});
    this.onClaim = onClaim || (() => {});
    this.onError = onError || (() => {});
    this.onKicked = onKicked || (() => {});
    this.reintentos = 0;
    // RTT mando <-> servidor: el tramo WiFi, que es el que decide la viabilidad.
    this.rttServidor = new Latencia();
    // RTT mando <-> host completo, incluyendo el salto local hasta el navegador.
    this.rttHost = new Latencia();
    this._timers = [];
  }

  conectar() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${proto}//${location.host}`);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      this.reintentos = 0;
      // Se manda el token guardado: si el servidor lo reconoce, se recupera el
      // mismo slot sin pasar por la selección.
      this.ws.send(JSON.stringify({ t: 'hello', role: 'pad', token: this.token }));
      this.onEstado('conectado');
      this._arrancarTimers();
    };

    this.ws.onmessage = (ev) => {
      if (typeof ev.data !== 'string') return;
      const msg = JSON.parse(ev.data);
      const ahora = performance.now();
      switch (msg.t) {
        case 'welcome':
          this.token = msg.token;
          sessionStorage.setItem(CLAVE_TOKEN, msg.token);
          if (msg.slots) this.onSlots(msg.slots);
          if (msg.slot) { this.slot = msg.slot; this.onClaim(msg.slot); }
          break;
        case 'slots':
          this.onSlots(msg.slots);
          break;
        case 'claimed':
          this.slot = msg.slot;
          if (msg.slot) this.onClaim(msg.slot);
          break;
        case 'kicked':
          // El token expulsado ya no vale: se borra para no intentar recuperar
          // un puesto del que nos han echado.
          this.slot = null;
          this.token = null;
          sessionStorage.removeItem(CLAVE_TOKEN);
          this.onKicked();
          break;
        case 'error':
          if (msg.slots) this.onSlots(msg.slots);
          this.onError(msg.code);
          break;
        case 'pong':
          this.rttServidor.add(ahora - msg.ts);
          break;
        case 'echo-pong':
          this.rttHost.add(ahora - msg.ts);
          break;
      }
    };

    this.ws.onclose = () => {
      this._pararTimers();
      this.onEstado('desconectado');
      // Reintento con espera creciente, tope de 5 s (HU-16).
      this.reintentos++;
      const espera = Math.min(5000, 250 * 2 ** Math.min(this.reintentos, 5));
      setTimeout(() => this.conectar(), espera);
    };
    this.ws.onerror = () => this.onEstado('error');
  }

  /** Pide un slot. La respuesta llega como `claimed` o como `error`. */
  reclamar(slot) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ t: 'claim', slot }));
  }

  /** Guardado y carga rápida. Solo lo acepta el servidor si somos el jugador 1. */
  hotkey(id) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ t: 'hotkey', id }));
  }

  /** Libera el puesto de otro jugador. Solo lo acepta el servidor si somos el 1. */
  expulsar(slot) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ t: 'kick', slot }));
  }

  /** Suelta el slot actual y vuelve a la selección. */
  soltar() {
    this.slot = null;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ t: 'release' }));
    }
  }

  /** Fija o suelta un botón. Solo emite si la máscara cambia de verdad. */
  setBoton(indice, pulsado) {
    const bit = 1 << indice;
    const nueva = pulsado ? this.mask | bit : this.mask & ~bit;
    if (nueva === this.mask) return;
    this.mask = nueva;
    this._enviarEstado();
  }

  _enviarEstado() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (!this.slot) return;   // sin slot no hay a quién mover
    this.seq = (this.seq + 1) & 0xff;
    this.ws.send(encode(this.slot, this.mask, this.seq));
  }

  _arrancarTimers() {
    this._pararTimers();
    // Latido: reenvía el estado actual aunque no haya cambiado, para que una
    // pulsación perdida no se quede pegada indefinidamente.
    this._timers.push(setInterval(() => this._enviarEstado(), HEARTBEAT_MS));
    this._timers.push(setInterval(() => {
      if (this.ws.readyState !== WebSocket.OPEN) return;
      const ts = performance.now();
      this.ws.send(JSON.stringify({ t: 'ping', ts }));
      this.ws.send(JSON.stringify({ t: 'echo', ts }));
    }, PING_MS));

    // Resumen periódico al host, para la superposición de diagnóstico.
    this._timers.push(setInterval(() => {
      if (this.ws.readyState !== WebSocket.OPEN || !this.slot) return;
      const r = this.rttServidor;
      if (!r.n) return;
      this.ws.send(JSON.stringify({
        t: 'stats',
        datos: {
          // Latencia de ida: la mitad del RTT, que es la cifra del criterio.
          ida: Number((r.percentil(50) / 2).toFixed(1)),
          idaP95: Number((r.p95 / 2).toFixed(1)),
          host: this.rttHost.n ? Number(this.rttHost.media.toFixed(1)) : null
        }
      }));
    }, 1000));
  }

  _pararTimers() {
    this._timers.forEach(clearInterval);
    this._timers = [];
  }
}

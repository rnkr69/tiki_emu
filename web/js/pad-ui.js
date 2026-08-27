// Controles del mando: cruceta multitáctil y botones.
//
// No sabe de red: recibe una función `onCambio(indice, pulsado)` y se limita a
// traducir dedos en botones. La realimentación visual es local y no espera
// confirmación de nadie (§11).

import { BTN } from './protocol.js';

/** Proporción del radio que no responde, para evitar direcciones accidentales. */
const ZONA_MUERTA = 0.28;

/** Vibración al pulsar, en milisegundos. Corta o se nota como lag. */
const VIBRACION_MS = 10;

export class PadUI {
  /**
   * @param {object} opciones
   * @param {HTMLElement} opciones.cruceta  contenedor de la cruceta
   * @param {NodeList|Array} opciones.botones elementos con data-btn
   * @param {(indice:number, pulsado:boolean)=>void} opciones.onCambio
   */
  constructor({ cruceta, botones, onCambio }) {
    this.cruceta = cruceta;
    this.onCambio = onCambio;
    // Estado local de cada índice, para no emitir cambios repetidos.
    this.estado = new Map();
    // Qué puntero está sobre qué botón, para soltar bien con varios dedos.
    this.punteros = new Map();

    this._montarCruceta();
    for (const el of botones) this._montarBoton(el);

    // Un dedo que sale de la ventana no genera pointerup en el elemento.
    window.addEventListener('pointercancel', (ev) => this._soltarPuntero(ev.pointerId));
    window.addEventListener('blur', () => this.soltarTodo());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.soltarTodo();
    });
  }

  /** Emite un cambio solo si el estado del botón cambia de verdad. */
  _fijar(indice, pulsado) {
    if (this.estado.get(indice) === pulsado) return;
    this.estado.set(indice, pulsado);
    this.onCambio(indice, pulsado);
  }

  _vibrar() {
    if (navigator.vibrate) navigator.vibrate(VIBRACION_MS);
  }

  /**
   * La captura del puntero es lo que garantiza recibir el pointerup aunque el
   * dedo se salga del botón. Si falla, se sigue adelante igualmente: perder la
   * captura es molesto, pero perder la pulsación entera es un botón que no
   * responde.
   */
  _capturar(el, pointerId) {
    try {
      el.setPointerCapture(pointerId);
    } catch {
      /* el puntero ya no existe: no es motivo para abortar la pulsación */
    }
  }

  // --- Botones de acción -----------------------------------------------------

  _montarBoton(el) {
    const indice = BTN[el.dataset.btn];
    if (indice === undefined) return;

    el.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      this._capturar(el, ev.pointerId);
      this.punteros.set(ev.pointerId, { tipo: 'boton', el, indice });
      el.classList.add('pulsado');
      this._fijar(indice, true);
      this._vibrar();
    });

    const soltar = (ev) => {
      ev.preventDefault();
      this._soltarPuntero(ev.pointerId);
    };
    el.addEventListener('pointerup', soltar);
    el.addEventListener('pointercancel', soltar);
    el.addEventListener('contextmenu', (ev) => ev.preventDefault());
  }

  // --- Cruceta ---------------------------------------------------------------

  _montarCruceta() {
    const el = this.cruceta;

    const actualizar = (ev) => {
      const r = el.getBoundingClientRect();
      // Posición del dedo respecto al centro, normalizada a [-1, 1].
      const x = (ev.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const y = (ev.clientY - (r.top + r.height / 2)) / (r.height / 2);
      this._aplicarDireccion(x, y);
    };

    el.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      this._capturar(el, ev.pointerId);
      this.punteros.set(ev.pointerId, { tipo: 'cruceta', el });
      actualizar(ev);
      this._vibrar();
    });

    el.addEventListener('pointermove', (ev) => {
      // Solo interesa el dedo que está mandando en la cruceta.
      if (this.punteros.get(ev.pointerId)?.tipo !== 'cruceta') return;
      ev.preventDefault();
      actualizar(ev);
    });

    const soltar = (ev) => {
      ev.preventDefault();
      this._soltarPuntero(ev.pointerId);
    };
    el.addEventListener('pointerup', soltar);
    el.addEventListener('pointercancel', soltar);
    el.addEventListener('contextmenu', (ev) => ev.preventDefault());
  }

  /**
   * La cruceta es UNA zona táctil, no cuatro botones: la dirección sale de dónde
   * está el dedo respecto al centro. Eso es lo que permite las diagonales, que
   * cuatro botones separados no darían (HU-12).
   */
  _aplicarDireccion(x, y) {
    const distancia = Math.hypot(x, y);
    if (distancia < ZONA_MUERTA) {
      this._soltarDirecciones();
      this.cruceta.dataset.dir = '';
      return;
    }

    // Cada eje se activa por separado, así que dos direcciones pueden convivir.
    // El umbral relativo evita que rozar el eje contrario cuente como diagonal.
    const umbral = 0.38;
    const arriba = y < -umbral;
    const abajo = y > umbral;
    const izquierda = x < -umbral;
    const derecha = x > umbral;

    this._fijar(BTN.UP, arriba);
    this._fijar(BTN.DOWN, abajo);
    this._fijar(BTN.LEFT, izquierda);
    this._fijar(BTN.RIGHT, derecha);

    // Para pintar el estado: se lee desde CSS.
    this.cruceta.dataset.dir =
      [arriba && 'n', abajo && 's', izquierda && 'o', derecha && 'e'].filter(Boolean).join('');
  }

  _soltarDirecciones() {
    this._fijar(BTN.UP, false);
    this._fijar(BTN.DOWN, false);
    this._fijar(BTN.LEFT, false);
    this._fijar(BTN.RIGHT, false);
  }

  _soltarPuntero(pointerId) {
    const info = this.punteros.get(pointerId);
    if (!info) return;
    this.punteros.delete(pointerId);
    if (info.tipo === 'cruceta') {
      this._soltarDirecciones();
      this.cruceta.dataset.dir = '';
    } else {
      info.el.classList.remove('pulsado');
      this._fijar(info.indice, false);
    }
  }

  /** Suelta todo. Se llama cuando la app pierde el foco: nada debe quedarse pegado. */
  soltarTodo() {
    for (const id of [...this.punteros.keys()]) this._soltarPuntero(id);
    for (const [indice, pulsado] of this.estado) {
      if (pulsado) this._fijar(indice, false);
    }
  }
}

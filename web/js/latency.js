// Estadísticas de latencia sobre una ventana deslizante de muestras.
// Fichero puro: ni DOM ni red. Se reutilizará en la superposición de
// depuración de HU-17.

const MUESTRAS_MAX = 200;

export class Latencia {
  constructor(max = MUESTRAS_MAX) {
    this.max = max;
    this.muestras = [];
    this.descartados = 0;
  }

  /** Añade una medición en milisegundos. */
  add(ms) {
    this.muestras.push(ms);
    if (this.muestras.length > this.max) this.muestras.shift();
  }

  /** Cuenta un paquete descartado por secuencia antigua. */
  descartar() {
    this.descartados++;
  }

  get n() {
    return this.muestras.length;
  }

  get media() {
    if (!this.n) return null;
    return this.muestras.reduce((a, b) => a + b, 0) / this.n;
  }

  get min() {
    return this.n ? Math.min(...this.muestras) : null;
  }

  get max_() {
    return this.n ? Math.max(...this.muestras) : null;
  }

  /** Percentil 0-100 sobre la ventana actual. */
  percentil(p) {
    if (!this.n) return null;
    const ordenadas = [...this.muestras].sort((a, b) => a - b);
    const i = Math.min(ordenadas.length - 1, Math.ceil((p / 100) * ordenadas.length) - 1);
    return ordenadas[Math.max(0, i)];
  }

  get p95() {
    return this.percentil(95);
  }

  /** Resumen en una línea, listo para pintar. */
  resumen(etiqueta = '') {
    if (!this.n) return `${etiqueta} sin datos`;
    const f = (v) => (v === null ? '—' : v.toFixed(1));
    return `${etiqueta} media ${f(this.media)} · p95 ${f(this.p95)} · min ${f(this.min)} · max ${f(this.max_)} · n=${this.n}` +
      (this.descartados ? ` · descartados ${this.descartados}` : '');
  }

  reset() {
    this.muestras = [];
    this.descartados = 0;
  }
}

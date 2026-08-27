// Traducción de la interfaz.
//
// Sin dependencias y con los diccionarios importados de forma estática, no con
// fetch: así `t()` funciona desde la primera línea, sin esperas ni una petición
// que pueda fallar. Son unos pocos kilobytes.
//
// Reparto de responsabilidades, para no tener dos sistemas compitiendo:
//   · lo que está escrito en el HTML se marca con data-i18n y lo rellena aplicar()
//   · lo que se crea desde JavaScript llama a t() al construirlo
// Nunca se llama a aplicar() después de repintar algo hecho en JavaScript.

import { es } from './idiomas/es.js';
import { en } from './idiomas/en.js';

const DICCIONARIOS = { es, en };

/** Idioma en uso. Lo decide el script del <head>, que escribe <html lang>. */
export const idioma = DICCIONARIOS[document.documentElement.lang] ? document.documentElement.lang : 'es';

const textos = DICCIONARIOS[idioma];

/**
 * Traduce una clave, sustituyendo los huecos con nombre: t('mando.barra.jugador', {n: 2}).
 *
 * Si falta la traducción devuelve la clave, que es fea pero visible: un texto
 * vacío escondería el fallo hasta que lo viera un usuario.
 */
export function t(clave, valores) {
  const texto = textos[clave] ?? es[clave] ?? clave;
  if (!valores) return texto;
  return texto.replace(/\{(\w+)\}/g, (_, nombre) =>
    valores[nombre] !== undefined ? valores[nombre] : `{${nombre}}`
  );
}

/**
 * Rellena el marcado traducible de un árbol del DOM.
 *
 *   data-i18n="clave"                        → contenido del elemento
 *   data-i18n-attr="placeholder:clave"       → un atributo
 *   data-i18n-attr="placeholder:a,title:b"   → varios, separados por comas
 */
export function aplicar(raiz = document) {
  for (const el of raiz.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const el of raiz.querySelectorAll('[data-i18n-attr]')) {
    for (const par of el.dataset.i18nAttr.split(',')) {
      const [atributo, clave] = par.split(':').map((s) => s.trim());
      if (atributo && clave) el.setAttribute(atributo, t(clave));
    }
  }
  const titulo = raiz.querySelector?.('title[data-i18n-title]');
  if (titulo) document.title = t(titulo.dataset.i18nTitle);

  // El contenido estaba oculto para no enseñar el idioma original un instante.
  document.documentElement.classList.remove('i18n-pendiente');
}

/** Idioma en el formato que espera EmulatorJS para sus ficheros. */
export function idiomaEmulador() {
  return idioma === 'es' ? 'es-ES' : 'en-US';
}

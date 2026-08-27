// Lobby del host: QR de emparejamiento y estado de los slots.
//
// Como todo en web/, no sabe quién le está sirviendo: la URL del mando se
// deduce de la dirección por la que ha llegado el navegador.

import { t } from './i18n.js';

/**
 * URL que abrirán los invitados al escanear.
 *
 * Cuidado con lo obvio: el host se abre en 127.0.0.1, que es estable aunque
 * cambie de red, pero esa dirección en el móvil de un invitado apunta a su
 * propio teléfono. Por eso, si estamos en local, se usa la dirección de red que
 * ha informado el servidor.
 *
 * @param {Array<{ip: string, puerto: number}>} direcciones
 */
export function urlDelMando(direcciones = []) {
  const enLocal = ['127.0.0.1', 'localhost', '::1'].includes(location.hostname);
  if (enLocal && direcciones.length) {
    const { ip, puerto } = direcciones[0];
    return `http://${ip}:${puerto}/pad.html`;
  }
  return `${location.origin}/pad.html`;
}

/**
 * Cadena que entienden las cámaras de Android e iOS para conectarse a una red
 * WiFi. El formato lo define el propio estándar de códigos QR de WiFi; los
 * caracteres reservados van escapados con contrabarra.
 *
 * @param {{ssid: string, clave: string|null}} red
 */
export function textoQrRed(red) {
  const escapar = (s) => String(s).replace(/([\\;,:"])/g, '\\$1');
  const seguridad = red.clave ? 'WPA' : 'nopass';
  return `WIFI:T:${seguridad};S:${escapar(red.ssid)};` +
    (red.clave ? `P:${escapar(red.clave)};` : '') + ';';
}

/**
 * Pinta el QR de la URL del mando.
 * Usa qrcode.min.js, cargado como script clásico (expone QRCode global).
 */
export function pintarQR(contenedor, texto, tamano = 220) {
  contenedor.innerHTML = '';
  if (typeof QRCode === 'undefined') {
    contenedor.textContent = texto;
    return;
  }
  // eslint-disable-next-line no-new
  new QRCode(contenedor, {
    text: texto,
    width: tamano,
    height: tamano,
    correctLevel: QRCode.CorrectLevel.M
  });
}

/** Dibuja el estado de los puestos que anuncie el servidor. */
export function pintarSlots(contenedor, slots) {
  contenedor.innerHTML = '';
  for (const s of slots) {
    const el = document.createElement('div');
    el.className = `puesto jugador-${s.n}`;
    el.classList.toggle('ocupado', Boolean(s.taken));
    el.classList.toggle('caido', Boolean(s.taken) && !s.conectado);
    el.innerHTML = `<span class="numero">${s.n}</span><span class="etiqueta">${
      t(s.taken
        ? (s.conectado ? 'lobby.puesto.listo' : 'lobby.puesto.reconectando')
        : 'lobby.puesto.libre')
    }</span>`;
    contenedor.appendChild(el);
  }
}

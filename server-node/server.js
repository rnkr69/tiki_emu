// Arranque desde la línea de órdenes: en un PC para desarrollar, o en el móvil
// con Termux.
//
// Todo lo que hace el servidor está en servidor.js; aquí solo se decide lo que
// es propio de esta forma de arrancarlo — dónde están las carpetas y qué se
// imprime por consola. La app de escritorio importa la misma fábrica con otras
// respuestas a esas mismas preguntas.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearServidor, direccionesLocales } from './servidor.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO = Number(process.env.PUERTO) || 8080;

/**
 * Carpeta de ROMs en el almacenamiento normal del teléfono, para poder
 * arrastrar ficheros por USB como a un pendrive y que aparezcan en el catálogo
 * sin abrir Termux. Se puede fijar con ROMS_EXTRA; si no, se busca en los
 * sitios habituales de Android.
 */
const ROMS_EXTRA = (() => {
  if (process.env.ROMS_EXTRA) return process.env.ROMS_EXTRA;
  const candidatos = [
    '/sdcard/Roms',
    '/storage/emulated/0/Roms',
    path.join(process.env.HOME || '', 'storage/shared/Roms')
  ];
  return candidatos.find((c) => { try { return fs.statSync(c).isDirectory(); } catch { return false; } }) || null;
})();

const consola = crearServidor({
  puerto: PUERTO,
  web: path.join(RAIZ, 'web'),
  roms: path.join(RAIZ, 'roms'),
  romsExtra: ROMS_EXTRA,
  // Sin cabeceras de aislamiento: aquí se sirve por HTTP plano a la red local,
  // que no es contexto seguro, así que no habilitarían nada.
  cabecerasExtra: {},
  registrar: (codigo, url) => console.log(codigo === null ? url : `${codigo} ${url}`)
  // Sin `alPedirCarpeta`: desde la consola la carpeta se fija con ROMS_EXTRA, no
  // con un selector, así que el lobby no debe ofrecer ese botón.
});

try {
  await consola.escuchar();
} catch (e) {
  if (e.code === 'EADDRINUSE') {
    console.error(`El puerto ${PUERTO} ya está ocupado. Cierra la otra consola, o arranca con PUERTO=8081.`);
  } else {
    console.error(`No se pudo arrancar: ${e.message}`);
  }
  process.exit(1);
}

console.log(`Consola en http://localhost:${PUERTO}/  ·  mando en /pad.html`);
if (ROMS_EXTRA) {
  console.log(`Juegos también desde ${ROMS_EXTRA}`);
} else {
  console.log('Sugerencia: crea la carpeta /sdcard/Roms para añadir juegos por USB.');
}
for (const [nombre, ip] of direccionesLocales()) {
  console.log(`  ${nombre}: http://${ip}:${PUERTO}/pad.html`);
}

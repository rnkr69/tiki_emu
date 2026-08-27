// El servidor, en su propio proceso.
//
// No corre junto a la ventana porque el servidor hace su E/S de disco de forma
// síncrona —recorrer una carpeta con cientos de juegos son cientos de llamadas
// bloqueantes—, y ahí bloquearía el mismo bucle que dibuja la interfaz. Aquí
// puede tardar lo que quiera sin que la consola se congele.
//
// De paso reproduce la arquitectura de la app de Android por la misma razón que
// allí: quien sirve no tiene ventana, así que cuando hace falta un selector de
// carpetas se lo pide a quien sí la tiene.
//
// Este fichero no decide nada: traduce mensajes en llamadas y al revés.

import { crearServidor } from '../server-node/servidor.js';

let consola = null;

process.parentPort.on('message', async ({ data }) => {
  switch (data.t) {
    case 'arrancar': {
      consola = crearServidor({
        puerto: data.puerto,
        web: data.web,
        roms: data.roms,
        romsExtra: data.romsExtra,
        // En 127.0.0.1 sí hay contexto seguro, así que estas dos cabeceras
        // habilitan SharedArrayBuffer y con él los núcleos con hilos. Es la
        // ventaja que el escritorio tiene sobre el móvil.
        cabecerasExtra: {
          'cross-origin-opener-policy': 'same-origin',
          'cross-origin-embedder-policy': 'require-corp',
          'cross-origin-resource-policy': 'same-origin'
        },
        // El registro se manda al proceso principal en vez de escribirlo aquí:
        // la salida de un proceso de utilidad no aparece en ninguna parte, y sin
        // esto no hay forma de ver qué está haciendo el servidor.
        registrar: (codigo, texto) => enviar({ t: 'log', texto: codigo === null ? texto : `${codigo} ${texto}` }),
        alPedirCarpeta: () => enviar({ t: 'pedir-carpeta' }),
        alConectarMando: (remoto) => enviar({ t: 'mando', remoto })
      });

      try {
        await consola.escuchar();
        enviar({ t: 'listo', puerto: data.puerto, direcciones: consola.direcciones() });
      } catch (e) {
        enviar({ t: 'error', codigo: e.code || 'DESCONOCIDO', mensaje: e.message });
      }
      break;
    }

    case 'carpeta':
      consola?.fijarRomsExtra(data.ruta);
      consola?.difundirCatalogo();
      break;

    case 'reindexar':
      consola?.reindexar();
      consola?.difundirCatalogo();
      break;

    case 'cerrar':
      await consola?.cerrar();
      process.exit(0);
  }
});

function enviar(mensaje) {
  process.parentPort.postMessage(mensaje);
}

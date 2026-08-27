// Lo que la consola recuerda entre arranques.
//
// Un fichero JSON y treinta líneas, en vez de electron-store: el proyecto
// presume de tener una sola dependencia de runtime y no vale la pena romperlo
// por esto.

import fs from 'node:fs';
import path from 'node:path';

const POR_DEFECTO = {
  carpetaJuegos: null,      // null = todavía no ha elegido ninguna
  ventana: { ancho: 1280, alto: 800, maximizada: false },
  // Se apunta en cuanto entra el primer mando. Sirve para no repetir el aviso
  // del cortafuegos en una instalación que ya se sabe que funciona.
  mandoHaConectado: false
};

export function crearAjustes(carpeta) {
  const fichero = path.join(carpeta, 'ajustes.json');

  let valores = { ...POR_DEFECTO };
  try {
    // Cualquier cosa rara —fichero a medias, JSON inválido, versión antigua—
    // se resuelve volviendo a los valores por defecto. Unos ajustes corruptos
    // no pueden ser motivo de que la consola no arranque.
    valores = { ...POR_DEFECTO, ...JSON.parse(fs.readFileSync(fichero, 'utf8')) };
  } catch {
    /* primer arranque, o ilegible */
  }

  function guardar() {
    try {
      fs.mkdirSync(carpeta, { recursive: true });
      // Se escribe al lado y se renombra: un corte de luz a media escritura
      // dejaría el fichero bueno intacto en lugar de uno truncado.
      const temporal = `${fichero}.tmp`;
      fs.writeFileSync(temporal, JSON.stringify(valores, null, 2), 'utf8');
      fs.renameSync(temporal, fichero);
    } catch {
      /* si no se puede guardar, se sigue jugando igual */
    }
  }

  return {
    get: (clave) => valores[clave],
    set(clave, valor) {
      valores[clave] = valor;
      guardar();
    }
  };
}

#!/data/data/com.termux/files/usr/bin/bash
# Arranca la consola. Pensado para lanzarse desde un acceso directo de
# Termux:Widget, de modo que encender la consola sea un solo gesto (HU-01).

set -u

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
PUERTO="${PUERTO:-8080}"
PID_FILE="$RAIZ/.consola.pid"
LOG="$RAIZ/.consola.log"

# Si ya está corriendo, no se crea un segundo proceso: solo se abre el navegador.
if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "La consola ya estaba en marcha (pid $(cat "$PID_FILE"))."
else
  # Impide que Android duerma el proceso al salir de Termux (HU-04).
  termux-wake-lock 2>/dev/null || echo "Aviso: termux-wake-lock no disponible."

  cd "$RAIZ/server-node" || exit 1
  nohup node server.js >"$LOG" 2>&1 &
  echo $! >"$PID_FILE"

  # Margen para que el puerto quede escuchando antes de abrir el navegador.
  sleep 1
  echo "Consola arrancada (pid $(cat "$PID_FILE"))."
fi

# Abre el navegador en la consola. Se usa 127.0.0.1 y no la IP de la red: es
# estable aunque cambie el wifi, y es el origen que la Fase 4 usará en el WebView.
am start -a android.intent.action.VIEW -d "http://127.0.0.1:$PUERTO/" >/dev/null 2>&1 \
  || echo "Abre a mano http://127.0.0.1:$PUERTO/"

echo
echo "Mandos: mira la IP que ha impreso el servidor en $LOG"
grep -m3 'http://' "$LOG" 2>/dev/null || true

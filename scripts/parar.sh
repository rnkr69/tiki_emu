#!/data/data/com.termux/files/usr/bin/bash
# Para la consola y suelta el wake lock, para que no consuma batería cuando no
# se juega (HU-02).

set -u

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="$RAIZ/.consola.pid"

parado=0

if [ -f "$PID_FILE" ]; then
  PID="$(cat "$PID_FILE")"
  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID"
    # Un margen para que cierre el puerto por las buenas antes de insistir.
    sleep 1
    kill -0 "$PID" 2>/dev/null && kill -9 "$PID" 2>/dev/null
    echo "Consola parada (pid $PID)."
    parado=1
  fi
  rm -f "$PID_FILE"
fi

# Red de seguridad: si el fichero de pid se perdió, se busca el proceso igual,
# porque el puerto tiene que quedar libre para el siguiente arranque.
if [ "$parado" = "0" ]; then
  if pkill -f "node server.js" 2>/dev/null; then
    echo "Consola parada (proceso encontrado por nombre)."
  else
    echo "La consola no estaba en marcha."
  fi
fi

termux-wake-unlock 2>/dev/null || true
echo "Wake lock liberado."

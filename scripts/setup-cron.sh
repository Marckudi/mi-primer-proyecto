#!/usr/bin/env bash
# Instala los cron jobs para AlphaVision AI Instagram Auto-Publish
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
NODE_BIN="$(which node 2>/dev/null || echo "")"
RUN_SCRIPT="$SCRIPT_DIR/run.sh"
LOG_FILE="$PROJECT_DIR/data/cron.log"

echo ""
echo "📸  AlphaVision AI — Configurando automatización Instagram"
echo "    Proyecto: $PROJECT_DIR"
echo ""

if [ -z "$NODE_BIN" ]; then
  echo "❌  Error: Node.js no encontrado. Instálalo desde nodejs.org"
  exit 1
fi

if [ ! -f "$PROJECT_DIR/node_modules/.bin/tsx" ]; then
  echo "⚙️   Instalando dependencias npm..."
  cd "$PROJECT_DIR" && npm install
fi

if [ ! -f "$PROJECT_DIR/.env" ]; then
  echo ""
  echo "⚠️   No se encontró el archivo .env"
  echo "    1. Copia .env.example a .env"
  echo "    2. Rellena todas las credenciales"
  echo "    3. Vuelve a ejecutar: npm run setup"
  echo ""
  exit 1
fi

mkdir -p "$PROJECT_DIR/data"

cat > "$RUN_SCRIPT" << RUNNER
#!/usr/bin/env bash
cd "$PROJECT_DIR"
"$NODE_BIN" node_modules/.bin/tsx src/index.ts >> "$LOG_FILE" 2>&1
RUNNER
chmod +x "$RUN_SCRIPT"

MARKER="# alphavision-instagram-automation"
TMPFILE=$(mktemp)

crontab -l 2>/dev/null | grep -v "$MARKER" | grep -v "alphavision" > "$TMPFILE" || true

cat >> "$TMPFILE" << CRONS

$MARKER
# Genera contenido para el día (06:00 UTC = 08:00 CET)
0 6 * * * $RUN_SCRIPT
# Publica posts de mañana (09:00-10:00 UTC = 11:00 CET)
0 9,10 * * * $RUN_SCRIPT
# Publica posts de tarde (16:00-17:00 UTC = 18:00 CET)
0 16,17 * * * $RUN_SCRIPT
CRONS

crontab "$TMPFILE"
rm "$TMPFILE"

echo "✅  Cron jobs instalados correctamente"
echo ""
echo "    Horario de ejecución (UTC):"
echo "    • 06:00 → Genera contenido con Claude + DALL-E"
echo "    • 09:00 y 10:00 → Publica post de las 10:00 CET"
echo "    • 16:00 y 17:00 → Publica post de las 18:00 CET"
echo ""
echo "    Logs: $LOG_FILE"
echo "    Verificar cron: crontab -l"
echo "    Probar manualmente: npm start"
echo ""

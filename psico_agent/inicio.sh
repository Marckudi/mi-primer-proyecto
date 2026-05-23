#!/usr/bin/env bash
# Lanzador de PsicoIA
# Uso: ./inicio.sh

set -e

if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo ""
  echo "  ERROR: La variable ANTHROPIC_API_KEY no está configurada."
  echo "  Configúrala con:  export ANTHROPIC_API_KEY='tu-api-key'"
  echo ""
  exit 1
fi

# Crear entorno virtual si no existe
if [ ! -d ".venv" ]; then
  echo "  Creando entorno virtual..."
  python3 -m venv .venv
fi

source .venv/bin/activate

# Instalar dependencias si es necesario
pip install -q -r requirements.txt

# Lanzar el agente
python psico_agent.py

#!/bin/bash
# TrafficIQ — Quick start script
# Usage: ./start.sh [ANTHROPIC_API_KEY]

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

echo "📦 Installing dependencies..."
(cd "$BACKEND"  && npm install --silent)
(cd "$FRONTEND" && npm install --silent)

# Create .env if it doesn't exist
if [ ! -f "$BACKEND/.env" ]; then
  cp "$BACKEND/.env.example" "$BACKEND/.env"
fi

# Allow passing API key as argument
if [ -n "$1" ]; then
  echo "ANTHROPIC_API_KEY=$1" > "$BACKEND/.env"
  echo "PORT=3001" >> "$BACKEND/.env"
  echo "✅ API key configured"
fi

echo ""
echo "🚀 Starting TrafficIQ..."
echo "   Backend  → http://localhost:3001"
echo "   Frontend → http://localhost:5173"
echo ""
echo "📝 Add your Anthropic API key to backend/.env for full AI features"
echo "   (Without it, the app runs in demo mode)"
echo ""

# Run both concurrently
(cd "$BACKEND"  && node server.js) &
BACKEND_PID=$!

(cd "$FRONTEND" && npm run dev) &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped'" INT TERM
wait

#!/usr/bin/env python3
"""
Punto de entrada del sistema de gestión de la Agencia de Inteligencia.

Uso:
    python run.py

O con uvicorn directamente:
    uvicorn app.main:app --reload
"""
import uvicorn
import os
from dotenv import load_dotenv

load_dotenv()

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    debug = os.getenv("DEBUG", "true").lower() == "true"

    print(f"""
╔══════════════════════════════════════════════════════╗
║       AGENCIA DE INTELIGENCIA - SISTEMA DE GESTIÓN   ║
╠══════════════════════════════════════════════════════╣
║  URL: http://localhost:{port:<28} ║
║  Automatización: ACTIVA                              ║
║  Base de datos: SQLite (agencia.db)                  ║
╚══════════════════════════════════════════════════════╝
    """)

    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=debug,
        log_level="info",
    )

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

from app.database import init_db
from app.routers import dashboard, clients, services, contracts, payments, deliveries
from app.automation.scheduler import start_scheduler, stop_scheduler

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    _seed_initial_data()
    start_scheduler()
    yield
    # Shutdown
    stop_scheduler()


app = FastAPI(
    title="Agencia de Inteligencia - Sistema de Gestión",
    description="Plataforma de automatización para agencia de inteligencia empresarial",
    version="1.0.0",
    lifespan=lifespan,
)

# Static files
if os.path.exists("app/static"):
    app.mount("/static", StaticFiles(directory="app/static"), name="static")

# Routers
app.include_router(dashboard.router)
app.include_router(clients.router)
app.include_router(services.router)
app.include_router(contracts.router)
app.include_router(payments.router)
app.include_router(deliveries.router)


def _seed_initial_data():
    """Carga datos iniciales de ejemplo si la base de datos está vacía."""
    from app.database import SessionLocal
    from app.models import Service, ServiceCategory, Client, ClientStatus
    from datetime import datetime

    db = SessionLocal()
    try:
        if db.query(Service).count() > 0:
            return  # Ya hay datos

        # Servicios de inteligencia predefinidos
        services = [
            Service(
                name="Inteligencia Competitiva Básica",
                description="Análisis completo del panorama competitivo de su industria. Identificación de competidores clave, estrategias de mercado y posicionamiento.",
                category=ServiceCategory.inteligencia_competitiva,
                price=2500.00,
                duration_days=30,
                is_recurring=False,
                deliverables="Informe ejecutivo PDF, Dashboard de competidores, Presentación de hallazgos",
            ),
            Service(
                name="Monitoreo Continuo de Mercado",
                description="Vigilancia permanente del mercado, competencia y tendencias. Alertas en tiempo real y reportes mensuales.",
                category=ServiceCategory.monitoreo_continuo,
                price=1800.00,
                duration_days=30,
                is_recurring=True,
                deliverables="Reporte mensual, Alertas semanales por email, Dashboard en vivo",
            ),
            Service(
                name="Due Diligence Empresarial",
                description="Investigación exhaustiva de empresas para procesos de fusión, adquisición o alianza estratégica.",
                category=ServiceCategory.due_diligence,
                price=5000.00,
                duration_days=21,
                is_recurring=False,
                deliverables="Informe de due diligence completo, Análisis de riesgos, Recomendaciones ejecutivas",
            ),
            Service(
                name="Análisis de Riesgos Estratégicos",
                description="Evaluación integral de riesgos geopolíticos, regulatorios y de mercado para la toma de decisiones.",
                category=ServiceCategory.analisis_riesgos,
                price=3500.00,
                duration_days=45,
                is_recurring=False,
                deliverables="Matriz de riesgos, Informe de escenarios, Plan de mitigación",
            ),
            Service(
                name="Investigación de Mercados Premium",
                description="Investigación profunda de mercados objetivo con análisis cuantitativo y cualitativo.",
                category=ServiceCategory.investigacion_mercados,
                price=4200.00,
                duration_days=60,
                is_recurring=False,
                deliverables="Informe de mercado, Base de datos, Análisis estadístico, Presentación ejecutiva",
            ),
            Service(
                name="Monitoreo de Marca y Reputación",
                description="Vigilancia continua de la reputación online y offline de su marca en medios y redes sociales.",
                category=ServiceCategory.monitoreo_marca,
                price=1200.00,
                duration_days=30,
                is_recurring=True,
                deliverables="Dashboard de reputación, Reportes semanales, Alertas inmediatas",
            ),
        ]

        for s in services:
            db.add(s)

        db.commit()
        print(f"[SEED] {len(services)} servicios de inteligencia creados")
    except Exception as e:
        print(f"[SEED ERROR] {e}")
        db.rollback()
    finally:
        db.close()

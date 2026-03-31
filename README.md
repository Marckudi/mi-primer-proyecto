# Sistema de Gestión - Agencia de Inteligencia

Plataforma de automatización completa para agencia de inteligencia empresarial.

## Características

- **Dashboard ejecutivo** con KPIs, gráficos de ingresos y alertas en tiempo real
- **Gestión de clientes** (empresas) con historial completo
- **Catálogo de servicios** de inteligencia configurables
- **Contratos automáticos**: al crear un contrato, se generan automáticamente los pagos y hitos de entrega
- **Seguimiento de pagos** con registro de cobros y notificaciones
- **Gestión de entregas** con flujo: Pendiente → En progreso → Completado → Entregado al cliente
- **Motor de automatización** que corre en segundo plano:
  - Recordatorios de pago (7, 3 y 1 día antes del vencimiento)
  - Alertas de pagos vencidos
  - Alertas de contratos por vencer (30 y 7 días)
  - Detección de entregas atrasadas
  - Resumen semanal
- **Notificaciones por email** automáticas a clientes y al propietario

## Inicio rápido

```bash
# Instalar dependencias
pip install -r requirements.txt

# Configurar (opcional)
cp .env.example .env
# Editar .env con tus datos

# Iniciar
python run.py
```

Abre http://localhost:8000 en tu navegador.

## Lo que solo necesitas hacer tú

1. **Revisar el dashboard** para ver pagos pendientes y vencidos
2. **Registrar pagos** cuando los clientes paguen (un clic)
3. **Marcar entregas como completadas** cuando termines el trabajo
4. **Hablar con clientes** cuando sea necesario

El sistema maneja automáticamente todo lo demás: recordatorios, alertas, calendarios de pago y notificaciones.

## Tecnología

- **Backend**: FastAPI + Python
- **Base de datos**: SQLite (SQLAlchemy)
- **Automatización**: APScheduler
- **Frontend**: Bootstrap 5 + Chart.js
- **Emails**: SMTP (configurable)

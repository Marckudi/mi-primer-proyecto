from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from app.database import get_db
from app.models import (
    Client, Service, Contract, Payment, ServiceDelivery, Notification,
    ClientStatus, ContractStatus, PaymentStatus, DeliveryStatus
)

router = APIRouter()
from app.templates_config import templates


@router.get("/", response_class=HTMLResponse)
async def dashboard(request: Request, db: Session = Depends(get_db)):
    now = datetime.utcnow()

    # KPIs principales
    total_clients = db.query(Client).filter(Client.status == ClientStatus.activo).count()
    active_contracts = db.query(Contract).filter(Contract.status == ContractStatus.activo).count()

    # Ingresos del mes
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    monthly_revenue = db.query(func.sum(Payment.amount)).filter(
        Payment.status == PaymentStatus.pagado,
        Payment.paid_date >= start_of_month
    ).scalar() or 0

    # Pagos pendientes totales
    pending_payments = db.query(func.sum(Payment.amount)).filter(
        Payment.status == PaymentStatus.pendiente
    ).scalar() or 0

    # Pagos vencidos
    overdue_payments = db.query(Payment).filter(
        Payment.status == PaymentStatus.pendiente,
        Payment.due_date < now
    ).all()

    # Próximos pagos (7 días)
    upcoming_payments = db.query(Payment).filter(
        Payment.status == PaymentStatus.pendiente,
        Payment.due_date >= now,
        Payment.due_date <= now + timedelta(days=7)
    ).order_by(Payment.due_date).all()

    # Entregas pendientes
    pending_deliveries = db.query(ServiceDelivery).filter(
        ServiceDelivery.status.in_([DeliveryStatus.pendiente, DeliveryStatus.en_progreso])
    ).order_by(ServiceDelivery.due_date).limit(5).all()

    # Contratos que vencen en 30 días
    expiring_contracts = db.query(Contract).filter(
        Contract.status == ContractStatus.activo,
        Contract.end_date >= now,
        Contract.end_date <= now + timedelta(days=30)
    ).all()

    # Notificaciones no leídas
    unread_notifications = db.query(Notification).filter(
        Notification.is_read == False
    ).order_by(Notification.created_at.desc()).limit(10).all()

    unread_count = db.query(Notification).filter(Notification.is_read == False).count()

    # Actividad reciente - últimos pagos recibidos
    recent_payments = db.query(Payment).filter(
        Payment.status == PaymentStatus.pagado
    ).order_by(Payment.paid_date.desc()).limit(5).all()

    # Ingresos por mes (últimos 6 meses)
    monthly_data = []
    for i in range(5, -1, -1):
        month_start = (now.replace(day=1) - timedelta(days=i * 30)).replace(day=1, hour=0, minute=0, second=0)
        month_end = (month_start + timedelta(days=32)).replace(day=1)
        amount = db.query(func.sum(Payment.amount)).filter(
            Payment.status == PaymentStatus.pagado,
            Payment.paid_date >= month_start,
            Payment.paid_date < month_end
        ).scalar() or 0
        monthly_data.append({
            "month": month_start.strftime("%b %Y"),
            "amount": float(amount)
        })

    return templates.TemplateResponse("dashboard.html", {
        "request": request,
        "total_clients": total_clients,
        "active_contracts": active_contracts,
        "monthly_revenue": monthly_revenue,
        "pending_payments": pending_payments,
        "overdue_payments": overdue_payments,
        "upcoming_payments": upcoming_payments,
        "pending_deliveries": pending_deliveries,
        "expiring_contracts": expiring_contracts,
        "unread_notifications": unread_notifications,
        "unread_count": unread_count,
        "recent_payments": recent_payments,
        "monthly_data": monthly_data,
        "now": now,
    })


@router.post("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: int, db: Session = Depends(get_db)):
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if notification:
        notification.is_read = True
        db.commit()
    return {"status": "ok"}


@router.post("/notifications/read-all")
async def mark_all_read(db: Session = Depends(get_db)):
    db.query(Notification).filter(Notification.is_read == False).update({"is_read": True})
    db.commit()
    return {"status": "ok"}

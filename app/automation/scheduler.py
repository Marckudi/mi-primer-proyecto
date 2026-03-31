"""
Motor de automatización - Tareas programadas que corren en segundo plano.

Tareas automáticas:
- Cada día: Detectar pagos vencidos y enviar alertas
- Cada día: Recordatorios de pago (7 días y 1 día antes)
- Cada día: Alertas de contratos que vencen en 30 y 7 días
- Cada día: Verificar entregas atrasadas
- Cada semana: Resumen semanal al propietario
"""
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import (
    Payment, Contract, ServiceDelivery, Notification,
    PaymentStatus, ContractStatus, DeliveryStatus, NotificationType
)
from app.automation.notifications import (
    email_payment_reminder,
    email_payment_overdue,
    email_service_delivered,
    email_contract_expiring,
    send_email,
)
import os

AGENCY_EMAIL = os.getenv("AGENCY_EMAIL", "")
AGENCY_NAME = os.getenv("AGENCY_NAME", "Agencia de Inteligencia")

scheduler = BackgroundScheduler(timezone="America/Bogota")


def get_db() -> Session:
    return SessionLocal()


# ─── Tarea 1: Detectar y marcar pagos vencidos ────────────────────────────────

def check_overdue_payments():
    """Marca como vencidos los pagos pendientes que pasaron su fecha límite."""
    db = get_db()
    try:
        now = datetime.utcnow()
        overdue = db.query(Payment).filter(
            Payment.status == PaymentStatus.pendiente,
            Payment.due_date < now,
        ).all()

        for payment in overdue:
            payment.status = PaymentStatus.vencido
            days_overdue = (now - payment.due_date).days

            # Notificación al propietario
            existing = db.query(Notification).filter(
                Notification.related_id == payment.id,
                Notification.related_type == "payment",
                Notification.type == NotificationType.pago_vencido,
            ).first()

            if not existing:
                notif = Notification(
                    type=NotificationType.pago_vencido,
                    title=f"Pago vencido: {payment.contract.client.company_name}",
                    message=f"El pago de ${payment.amount:,.2f} de {payment.contract.client.company_name} lleva {days_overdue} día(s) vencido.",
                    related_id=payment.id,
                    related_type="payment",
                )
                db.add(notif)

                # Email al propietario
                if AGENCY_EMAIL:
                    send_email(
                        AGENCY_EMAIL,
                        f"[ALERTA] Pago vencido - {payment.contract.client.company_name}",
                        f"<p>El pago de <strong>${payment.amount:,.2f}</strong> de <strong>{payment.contract.client.company_name}</strong> venció hace {days_overdue} día(s).</p>"
                    )

                # Email al cliente
                email_payment_overdue(
                    payment.contract.client.contact_name,
                    payment.contract.client.email,
                    payment.amount,
                    payment.due_date.strftime("%d/%m/%Y"),
                    payment.contract.title,
                    days_overdue,
                )

        if overdue:
            db.commit()
            print(f"[SCHEDULER] {len(overdue)} pagos marcados como vencidos")
    except Exception as e:
        print(f"[SCHEDULER ERROR] check_overdue_payments: {e}")
        db.rollback()
    finally:
        db.close()


# ─── Tarea 2: Recordatorios de pago ──────────────────────────────────────────

def send_payment_reminders():
    """Envía recordatorios de pago 7 días y 1 día antes del vencimiento."""
    db = get_db()
    try:
        now = datetime.utcnow()
        reminder_days = [7, 3, 1]

        for days in reminder_days:
            target_date = now + timedelta(days=days)
            payments = db.query(Payment).filter(
                Payment.status == PaymentStatus.pendiente,
                Payment.due_date >= target_date.replace(hour=0, minute=0, second=0),
                Payment.due_date < target_date.replace(hour=23, minute=59, second=59),
            ).all()

            for payment in payments:
                # Evitar duplicados: verificar si ya se envió recordatorio hoy
                today_start = now.replace(hour=0, minute=0, second=0)
                existing = db.query(Notification).filter(
                    Notification.related_id == payment.id,
                    Notification.related_type == "payment",
                    Notification.type == NotificationType.recordatorio_pago,
                    Notification.created_at >= today_start,
                ).first()

                if not existing:
                    notif = Notification(
                        type=NotificationType.recordatorio_pago,
                        title=f"Recordatorio: Pago en {days} día(s) - {payment.contract.client.company_name}",
                        message=f"Pago de ${payment.amount:,.2f} de {payment.contract.client.company_name} vence el {payment.due_date.strftime('%d/%m/%Y')}.",
                        related_id=payment.id,
                        related_type="payment",
                    )
                    db.add(notif)

                    # Email al cliente
                    email_payment_reminder(
                        payment.contract.client.contact_name,
                        payment.contract.client.email,
                        payment.amount,
                        payment.due_date.strftime("%d/%m/%Y"),
                        payment.contract.title,
                    )

        db.commit()
        print(f"[SCHEDULER] Recordatorios de pago procesados")
    except Exception as e:
        print(f"[SCHEDULER ERROR] send_payment_reminders: {e}")
        db.rollback()
    finally:
        db.close()


# ─── Tarea 3: Alertas de contratos por vencer ────────────────────────────────

def check_expiring_contracts():
    """Alerta de contratos que vencen en 30 y 7 días."""
    db = get_db()
    try:
        now = datetime.utcnow()
        alert_days = [30, 7]

        for days in alert_days:
            target = now + timedelta(days=days)
            contracts = db.query(Contract).filter(
                Contract.status == ContractStatus.activo,
                Contract.end_date >= target.replace(hour=0, minute=0, second=0),
                Contract.end_date < target.replace(hour=23, minute=59, second=59),
            ).all()

            for contract in contracts:
                today_start = now.replace(hour=0, minute=0, second=0)
                existing = db.query(Notification).filter(
                    Notification.related_id == contract.id,
                    Notification.related_type == "contract",
                    Notification.type == NotificationType.contrato_vence,
                    Notification.created_at >= today_start,
                ).first()

                if not existing:
                    notif = Notification(
                        type=NotificationType.contrato_vence,
                        title=f"Contrato vence en {days} días: {contract.client.company_name}",
                        message=f"El contrato '{contract.title}' con {contract.client.company_name} vence el {contract.end_date.strftime('%d/%m/%Y')}.",
                        related_id=contract.id,
                        related_type="contract",
                    )
                    db.add(notif)

                    # Email al cliente
                    email_contract_expiring(
                        contract.client.contact_name,
                        contract.client.email,
                        contract.title,
                        contract.end_date.strftime("%d/%m/%Y"),
                        days,
                    )

        db.commit()
        print(f"[SCHEDULER] Contratos por vencer procesados")
    except Exception as e:
        print(f"[SCHEDULER ERROR] check_expiring_contracts: {e}")
        db.rollback()
    finally:
        db.close()


# ─── Tarea 4: Verificar entregas atrasadas ────────────────────────────────────

def check_overdue_deliveries():
    """Notifica al propietario sobre entregas que están atrasadas."""
    db = get_db()
    try:
        now = datetime.utcnow()
        overdue = db.query(ServiceDelivery).filter(
            ServiceDelivery.status.in_([DeliveryStatus.pendiente, DeliveryStatus.en_progreso]),
            ServiceDelivery.due_date < now,
        ).all()

        for delivery in overdue:
            today_start = now.replace(hour=0, minute=0, second=0)
            existing = db.query(Notification).filter(
                Notification.related_id == delivery.id,
                Notification.related_type == "delivery",
                Notification.created_at >= today_start,
            ).first()

            if not existing:
                days_late = (now - delivery.due_date).days
                notif = Notification(
                    type=NotificationType.sistema,
                    title=f"Entrega atrasada: {delivery.title}",
                    message=f"La entrega '{delivery.title}' para {delivery.contract.client.company_name} lleva {days_late} día(s) de atraso.",
                    related_id=delivery.id,
                    related_type="delivery",
                )
                db.add(notif)

        if overdue:
            db.commit()
            print(f"[SCHEDULER] {len(overdue)} entregas atrasadas detectadas")
    except Exception as e:
        print(f"[SCHEDULER ERROR] check_overdue_deliveries: {e}")
        db.rollback()
    finally:
        db.close()


# ─── Tarea 5: Resumen semanal ─────────────────────────────────────────────────

def weekly_summary():
    """Genera un resumen semanal para el propietario."""
    db = get_db()
    try:
        now = datetime.utcnow()
        week_ago = now - timedelta(days=7)

        from sqlalchemy import func
        from app.models import Client, Service

        new_clients = db.query(Client).filter(Client.created_at >= week_ago).count()
        new_contracts = db.query(Contract).filter(Contract.created_at >= week_ago).count()
        payments_received = db.query(func.sum(Payment.amount)).filter(
            Payment.status == PaymentStatus.pagado,
            Payment.paid_date >= week_ago,
        ).scalar() or 0
        pending_payments = db.query(func.sum(Payment.amount)).filter(
            Payment.status.in_([PaymentStatus.pendiente, PaymentStatus.vencido]),
        ).scalar() or 0

        notif = Notification(
            type=NotificationType.sistema,
            title=f"Resumen semanal - {now.strftime('%d/%m/%Y')}",
            message=(
                f"Resumen de la semana:\n"
                f"- Nuevos clientes: {new_clients}\n"
                f"- Nuevos contratos: {new_contracts}\n"
                f"- Ingresos recibidos: ${payments_received:,.2f}\n"
                f"- Pagos pendientes: ${pending_payments:,.2f}"
            ),
        )
        db.add(notif)
        db.commit()
        print(f"[SCHEDULER] Resumen semanal generado")
    except Exception as e:
        print(f"[SCHEDULER ERROR] weekly_summary: {e}")
        db.rollback()
    finally:
        db.close()


def start_scheduler():
    """Inicia el motor de automatización."""
    # Tareas diarias a las 8 AM
    scheduler.add_job(check_overdue_payments, CronTrigger(hour=8, minute=0), id="overdue_payments", replace_existing=True)
    scheduler.add_job(send_payment_reminders, CronTrigger(hour=8, minute=30), id="payment_reminders", replace_existing=True)
    scheduler.add_job(check_expiring_contracts, CronTrigger(hour=9, minute=0), id="expiring_contracts", replace_existing=True)
    scheduler.add_job(check_overdue_deliveries, CronTrigger(hour=9, minute=30), id="overdue_deliveries", replace_existing=True)

    # Resumen semanal los lunes a las 7 AM
    scheduler.add_job(weekly_summary, CronTrigger(day_of_week="mon", hour=7, minute=0), id="weekly_summary", replace_existing=True)

    scheduler.start()
    print(f"[SCHEDULER] Motor de automatización iniciado - {datetime.utcnow()}")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown()
        print("[SCHEDULER] Motor de automatización detenido")

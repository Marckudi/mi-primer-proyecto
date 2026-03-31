from fastapi import APIRouter, Depends, Request, Form, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session
from datetime import datetime
from app.database import get_db
from app.models import Payment, Contract, Notification, NotificationType, PaymentStatus, ContractStatus

router = APIRouter(prefix="/pagos", tags=["payments"])
from app.templates_config import templates


@router.get("/", response_class=HTMLResponse)
async def list_payments(request: Request, db: Session = Depends(get_db), status: str = None):
    query = db.query(Payment)
    if status:
        query = query.filter(Payment.status == status)

    # Marcar vencidos automáticamente
    now = datetime.utcnow()
    overdue = db.query(Payment).filter(
        Payment.status == PaymentStatus.pendiente,
        Payment.due_date < now,
    ).all()
    for p in overdue:
        p.status = PaymentStatus.vencido
    if overdue:
        db.commit()

    payments = query.order_by(Payment.due_date.desc()).all()
    return templates.TemplateResponse("payments/list.html", {
        "request": request,
        "payments": payments,
        "status_filter": status,
        "PaymentStatus": PaymentStatus,
        "now": now,
    })


@router.post("/{payment_id}/registrar-pago")
async def register_payment(
    payment_id: int,
    payment_method: str = Form(""),
    reference: str = Form(""),
    notes: str = Form(""),
    db: Session = Depends(get_db),
):
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Pago no encontrado")

    payment.status = PaymentStatus.pagado
    payment.paid_date = datetime.utcnow()
    payment.payment_method = payment_method
    payment.reference = reference
    if notes:
        payment.notes = notes

    # Verificar si todos los pagos del contrato están pagados
    contract = payment.contract
    all_paid = all(p.status == PaymentStatus.pagado for p in contract.payments)
    if all_paid:
        contract.status = ContractStatus.completado

    # Notificación automática al propietario
    notification = Notification(
        type=NotificationType.pago_recibido,
        title=f"Pago recibido: ${payment.amount:,.2f}",
        message=f"Se registró pago de ${payment.amount:,.2f} del cliente {contract.client.company_name} para el contrato '{contract.title}'. Método: {payment_method or 'No especificado'}.",
        related_id=payment_id,
        related_type="payment",
    )
    db.add(notification)
    db.commit()

    return RedirectResponse(url=f"/contratos/{contract.id}", status_code=303)


@router.post("/{payment_id}/cancelar")
async def cancel_payment(payment_id: int, db: Session = Depends(get_db)):
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    payment.status = PaymentStatus.cancelado
    db.commit()
    return RedirectResponse(url=f"/contratos/{payment.contract_id}", status_code=303)


@router.get("/vencidos", response_class=HTMLResponse)
async def overdue_payments(request: Request, db: Session = Depends(get_db)):
    now = datetime.utcnow()
    payments = db.query(Payment).filter(
        Payment.status.in_([PaymentStatus.pendiente, PaymentStatus.vencido]),
        Payment.due_date < now,
    ).order_by(Payment.due_date).all()
    return templates.TemplateResponse("payments/overdue.html", {
        "request": request,
        "payments": payments,
        "now": now,
    })

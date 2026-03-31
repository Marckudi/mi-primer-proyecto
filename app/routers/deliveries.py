from fastapi import APIRouter, Depends, Request, Form, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session
from datetime import datetime
from app.database import get_db
from app.models import ServiceDelivery, Notification, NotificationType, DeliveryStatus

router = APIRouter(prefix="/entregas", tags=["deliveries"])
from app.templates_config import templates


@router.get("/", response_class=HTMLResponse)
async def list_deliveries(request: Request, db: Session = Depends(get_db), status: str = None):
    query = db.query(ServiceDelivery)
    if status:
        query = query.filter(ServiceDelivery.status == status)
    deliveries = query.order_by(ServiceDelivery.due_date).all()
    return templates.TemplateResponse("deliveries/list.html", {
        "request": request,
        "deliveries": deliveries,
        "status_filter": status,
        "DeliveryStatus": DeliveryStatus,
        "now": datetime.utcnow(),
    })


@router.post("/{delivery_id}/iniciar")
async def start_delivery(delivery_id: int, db: Session = Depends(get_db)):
    delivery = db.query(ServiceDelivery).filter(ServiceDelivery.id == delivery_id).first()
    if not delivery:
        raise HTTPException(status_code=404, detail="Entrega no encontrada")
    delivery.status = DeliveryStatus.en_progreso
    db.commit()
    return RedirectResponse(url=f"/contratos/{delivery.contract_id}", status_code=303)


@router.post("/{delivery_id}/completar")
async def complete_delivery(
    delivery_id: int,
    deliverable_url: str = Form(""),
    notes: str = Form(""),
    db: Session = Depends(get_db),
):
    delivery = db.query(ServiceDelivery).filter(ServiceDelivery.id == delivery_id).first()
    if not delivery:
        raise HTTPException(status_code=404, detail="Entrega no encontrada")

    delivery.status = DeliveryStatus.completado
    delivery.completed_date = datetime.utcnow()
    delivery.deliverable_url = deliverable_url
    if notes:
        delivery.notes = notes

    notification = Notification(
        type=NotificationType.servicio_entregado,
        title=f"Entrega completada: {delivery.title}",
        message=f"Se completó la entrega '{delivery.title}' para {delivery.contract.client.company_name}. Pendiente de envío al cliente.",
        related_id=delivery_id,
        related_type="delivery",
    )
    db.add(notification)
    db.commit()

    return RedirectResponse(url=f"/contratos/{delivery.contract_id}", status_code=303)


@router.post("/{delivery_id}/entregar")
async def deliver_to_client(
    delivery_id: int,
    deliverable_url: str = Form(""),
    notes: str = Form(""),
    db: Session = Depends(get_db),
):
    delivery = db.query(ServiceDelivery).filter(ServiceDelivery.id == delivery_id).first()
    if not delivery:
        raise HTTPException(status_code=404, detail="Entrega no encontrada")

    delivery.status = DeliveryStatus.entregado
    delivery.delivered_date = datetime.utcnow()
    if deliverable_url:
        delivery.deliverable_url = deliverable_url
    if notes:
        delivery.notes = notes

    notification = Notification(
        type=NotificationType.servicio_entregado,
        title=f"Servicio entregado al cliente: {delivery.contract.client.company_name}",
        message=f"La entrega '{delivery.title}' fue enviada a {delivery.contract.client.company_name} ({delivery.contract.client.email}).",
        related_id=delivery_id,
        related_type="delivery",
    )
    db.add(notification)
    db.commit()

    return RedirectResponse(url=f"/contratos/{delivery.contract_id}", status_code=303)


@router.get("/{delivery_id}/editar", response_class=HTMLResponse)
async def edit_delivery_form(request: Request, delivery_id: int, db: Session = Depends(get_db)):
    delivery = db.query(ServiceDelivery).filter(ServiceDelivery.id == delivery_id).first()
    if not delivery:
        raise HTTPException(status_code=404, detail="Entrega no encontrada")
    return templates.TemplateResponse("deliveries/form.html", {
        "request": request,
        "delivery": delivery,
        "DeliveryStatus": DeliveryStatus,
    })


@router.post("/{delivery_id}/editar")
async def update_delivery(
    delivery_id: int,
    title: str = Form(...),
    description: str = Form(""),
    due_date: str = Form(...),
    deliverable_url: str = Form(""),
    notes: str = Form(""),
    db: Session = Depends(get_db),
):
    delivery = db.query(ServiceDelivery).filter(ServiceDelivery.id == delivery_id).first()
    if not delivery:
        raise HTTPException(status_code=404, detail="Entrega no encontrada")

    delivery.title = title
    delivery.description = description
    delivery.due_date = datetime.fromisoformat(due_date)
    delivery.deliverable_url = deliverable_url
    delivery.notes = notes
    db.commit()

    return RedirectResponse(url=f"/contratos/{delivery.contract_id}", status_code=303)

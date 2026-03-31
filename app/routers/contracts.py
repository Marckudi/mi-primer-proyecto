from fastapi import APIRouter, Depends, Request, Form, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.database import get_db
from app.models import (
    Contract, Client, Service, Payment, ServiceDelivery,
    ContractStatus, PaymentStatus, DeliveryStatus, Notification, NotificationType
)

router = APIRouter(prefix="/contratos", tags=["contracts"])
from app.templates_config import templates


def _generate_payment_schedule(contract: Contract, db: Session):
    """Genera automáticamente el calendario de pagos según el contrato."""
    schedule = contract.payment_schedule
    start = contract.start_date
    end = contract.end_date
    total = contract.total_amount

    if schedule == "unico":
        payments = [Payment(
            contract_id=contract.id,
            amount=total,
            due_date=start,
            status=PaymentStatus.pendiente,
        )]
    elif schedule == "mensual":
        months = max(1, int((end - start).days / 30))
        amount_per = round(total / months, 2)
        payments = []
        for i in range(months):
            due = start + timedelta(days=30 * i)
            payments.append(Payment(
                contract_id=contract.id,
                amount=amount_per,
                due_date=due,
                status=PaymentStatus.pendiente,
            ))
    elif schedule == "trimestral":
        quarters = max(1, int((end - start).days / 90))
        amount_per = round(total / quarters, 2)
        payments = []
        for i in range(quarters):
            due = start + timedelta(days=90 * i)
            payments.append(Payment(
                contract_id=contract.id,
                amount=amount_per,
                due_date=due,
                status=PaymentStatus.pendiente,
            ))
    elif schedule == "50-50":
        mid = start + (end - start) / 2
        payments = [
            Payment(contract_id=contract.id, amount=round(total * 0.5, 2), due_date=start, status=PaymentStatus.pendiente),
            Payment(contract_id=contract.id, amount=round(total * 0.5, 2), due_date=mid, status=PaymentStatus.pendiente),
        ]
    else:
        payments = [Payment(contract_id=contract.id, amount=total, due_date=start, status=PaymentStatus.pendiente)]

    for p in payments:
        db.add(p)


def _generate_delivery_milestones(contract: Contract, db: Session):
    """Genera automáticamente los hitos de entrega del contrato."""
    service = contract.service
    start = contract.start_date
    end = contract.end_date
    duration = (end - start).days

    milestones = []

    if service.is_recurring:
        # Entrega mensual para servicios recurrentes
        months = max(1, int(duration / 30))
        for i in range(1, months + 1):
            due = start + timedelta(days=30 * i)
            milestones.append(ServiceDelivery(
                contract_id=contract.id,
                title=f"Entrega {i} - {service.name}",
                description=f"Entrega mensual {i} de {months} para {contract.client.company_name}",
                status=DeliveryStatus.pendiente,
                due_date=due,
            ))
    else:
        # Hito inicial (25%) y entrega final
        if duration > 14:
            milestones.append(ServiceDelivery(
                contract_id=contract.id,
                title=f"Informe preliminar - {service.name}",
                description=f"Entrega de avance/informe preliminar para {contract.client.company_name}",
                status=DeliveryStatus.pendiente,
                due_date=start + timedelta(days=int(duration * 0.4)),
            ))
        milestones.append(ServiceDelivery(
            contract_id=contract.id,
            title=f"Entrega final - {service.name}",
            description=f"Entrega final del servicio para {contract.client.company_name}",
            status=DeliveryStatus.pendiente,
            due_date=end,
        ))

    for m in milestones:
        db.add(m)


@router.get("/", response_class=HTMLResponse)
async def list_contracts(request: Request, db: Session = Depends(get_db), status: str = None):
    query = db.query(Contract)
    if status:
        query = query.filter(Contract.status == status)
    contracts = query.order_by(Contract.created_at.desc()).all()
    return templates.TemplateResponse("contracts/list.html", {
        "request": request,
        "contracts": contracts,
        "status_filter": status,
        "ContractStatus": ContractStatus,
    })


@router.get("/nuevo", response_class=HTMLResponse)
async def new_contract_form(request: Request, db: Session = Depends(get_db)):
    clients = db.query(Client).filter(Client.status == "activo").all()
    services = db.query(Service).filter(Service.is_active == True).all()
    return templates.TemplateResponse("contracts/form.html", {
        "request": request,
        "contract": None,
        "clients": clients,
        "services": services,
        "ContractStatus": ContractStatus,
    })


@router.post("/nuevo")
async def create_contract(
    request: Request,
    client_id: int = Form(...),
    service_id: int = Form(...),
    title: str = Form(""),
    status: str = Form("activo"),
    start_date: str = Form(...),
    end_date: str = Form(...),
    total_amount: float = Form(...),
    payment_schedule: str = Form("mensual"),
    notes: str = Form(""),
    db: Session = Depends(get_db),
):
    client = db.query(Client).filter(Client.id == client_id).first()
    service = db.query(Service).filter(Service.id == service_id).first()

    start = datetime.fromisoformat(start_date)
    end = datetime.fromisoformat(end_date)

    if not title:
        title = f"{service.name} - {client.company_name}"

    contract = Contract(
        client_id=client_id,
        service_id=service_id,
        title=title,
        status=ContractStatus(status),
        start_date=start,
        end_date=end,
        total_amount=total_amount,
        payment_schedule=payment_schedule,
        notes=notes,
    )
    db.add(contract)
    db.flush()

    # Generar pagos y entregas automáticamente
    _generate_payment_schedule(contract, db)
    _generate_delivery_milestones(contract, db)

    # Notificación automática
    notification = Notification(
        type=NotificationType.nuevo_contrato,
        title=f"Nuevo contrato: {title}",
        message=f"Contrato creado para {client.company_name} - {service.name}. Monto: ${total_amount:,.2f}. Pagos generados automáticamente.",
        related_id=contract.id,
        related_type="contract",
    )
    db.add(notification)
    db.commit()

    return RedirectResponse(url=f"/contratos/{contract.id}", status_code=303)


@router.get("/{contract_id}", response_class=HTMLResponse)
async def get_contract(request: Request, contract_id: int, db: Session = Depends(get_db)):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")
    return templates.TemplateResponse("contracts/detail.html", {
        "request": request,
        "contract": contract,
        "PaymentStatus": PaymentStatus,
        "DeliveryStatus": DeliveryStatus,
        "now": datetime.utcnow(),
    })


@router.get("/{contract_id}/editar", response_class=HTMLResponse)
async def edit_contract_form(request: Request, contract_id: int, db: Session = Depends(get_db)):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")
    clients = db.query(Client).all()
    services = db.query(Service).filter(Service.is_active == True).all()
    return templates.TemplateResponse("contracts/form.html", {
        "request": request,
        "contract": contract,
        "clients": clients,
        "services": services,
        "ContractStatus": ContractStatus,
    })


@router.post("/{contract_id}/editar")
async def update_contract(
    contract_id: int,
    title: str = Form(""),
    status: str = Form("activo"),
    notes: str = Form(""),
    db: Session = Depends(get_db),
):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")

    contract.title = title
    contract.status = ContractStatus(status)
    contract.notes = notes
    contract.updated_at = datetime.utcnow()
    db.commit()

    return RedirectResponse(url=f"/contratos/{contract_id}", status_code=303)


@router.post("/{contract_id}/estado/{new_status}")
async def change_contract_status(contract_id: int, new_status: str, db: Session = Depends(get_db)):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Contrato no encontrado")
    contract.status = ContractStatus(new_status)
    db.commit()
    return RedirectResponse(url=f"/contratos/{contract_id}", status_code=303)

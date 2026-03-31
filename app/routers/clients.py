from fastapi import APIRouter, Depends, Request, Form, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from app.database import get_db
from app.models import Client, ClientStatus, Notification, NotificationType

router = APIRouter(prefix="/clientes", tags=["clients"])
from app.templates_config import templates


@router.get("/", response_class=HTMLResponse)
async def list_clients(request: Request, db: Session = Depends(get_db), status: Optional[str] = None):
    query = db.query(Client)
    if status:
        query = query.filter(Client.status == status)
    clients = query.order_by(Client.created_at.desc()).all()
    return templates.TemplateResponse("clients/list.html", {
        "request": request,
        "clients": clients,
        "status_filter": status,
    })


@router.get("/nuevo", response_class=HTMLResponse)
async def new_client_form(request: Request):
    return templates.TemplateResponse("clients/form.html", {
        "request": request,
        "client": None,
        "statuses": ClientStatus,
    })


@router.post("/nuevo")
async def create_client(
    request: Request,
    company_name: str = Form(...),
    contact_name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(""),
    address: str = Form(""),
    industry: str = Form(""),
    status: str = Form("activo"),
    notes: str = Form(""),
    db: Session = Depends(get_db),
):
    existing = db.query(Client).filter(Client.email == email).first()
    if existing:
        return templates.TemplateResponse("clients/form.html", {
            "request": request,
            "client": None,
            "statuses": ClientStatus,
            "error": f"Ya existe un cliente con el email {email}",
        })

    client = Client(
        company_name=company_name,
        contact_name=contact_name,
        email=email,
        phone=phone,
        address=address,
        industry=industry,
        status=ClientStatus(status),
        notes=notes,
    )
    db.add(client)
    db.flush()

    # Notificación automática
    notification = Notification(
        type=NotificationType.nuevo_cliente,
        title=f"Nuevo cliente: {company_name}",
        message=f"Se registró el cliente {company_name} ({contact_name}) - {email}",
        related_id=client.id,
        related_type="client",
    )
    db.add(notification)
    db.commit()

    return RedirectResponse(url=f"/clientes/{client.id}", status_code=303)


@router.get("/{client_id}", response_class=HTMLResponse)
async def get_client(request: Request, client_id: int, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return templates.TemplateResponse("clients/detail.html", {
        "request": request,
        "client": client,
    })


@router.get("/{client_id}/editar", response_class=HTMLResponse)
async def edit_client_form(request: Request, client_id: int, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return templates.TemplateResponse("clients/form.html", {
        "request": request,
        "client": client,
        "statuses": ClientStatus,
    })


@router.post("/{client_id}/editar")
async def update_client(
    request: Request,
    client_id: int,
    company_name: str = Form(...),
    contact_name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(""),
    address: str = Form(""),
    industry: str = Form(""),
    status: str = Form("activo"),
    notes: str = Form(""),
    db: Session = Depends(get_db),
):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    client.company_name = company_name
    client.contact_name = contact_name
    client.email = email
    client.phone = phone
    client.address = address
    client.industry = industry
    client.status = ClientStatus(status)
    client.notes = notes
    client.updated_at = datetime.utcnow()
    db.commit()

    return RedirectResponse(url=f"/clientes/{client_id}", status_code=303)


@router.post("/{client_id}/eliminar")
async def delete_client(client_id: int, db: Session = Depends(get_db)):
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    db.delete(client)
    db.commit()
    return RedirectResponse(url="/clientes/", status_code=303)

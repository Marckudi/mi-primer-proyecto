from fastapi import APIRouter, Depends, Request, Form, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Service, ServiceCategory

router = APIRouter(prefix="/servicios", tags=["services"])
from app.templates_config import templates


@router.get("/", response_class=HTMLResponse)
async def list_services(request: Request, db: Session = Depends(get_db)):
    services = db.query(Service).order_by(Service.category, Service.name).all()
    return templates.TemplateResponse("services/list.html", {
        "request": request,
        "services": services,
    })


@router.get("/nuevo", response_class=HTMLResponse)
async def new_service_form(request: Request):
    return templates.TemplateResponse("services/form.html", {
        "request": request,
        "service": None,
        "categories": ServiceCategory,
    })


@router.post("/nuevo")
async def create_service(
    request: Request,
    name: str = Form(...),
    description: str = Form(""),
    category: str = Form("otro"),
    price: float = Form(...),
    duration_days: int = Form(30),
    is_recurring: bool = Form(False),
    deliverables: str = Form(""),
    db: Session = Depends(get_db),
):
    service = Service(
        name=name,
        description=description,
        category=ServiceCategory(category),
        price=price,
        duration_days=duration_days,
        is_recurring=is_recurring,
        deliverables=deliverables,
        is_active=True,
    )
    db.add(service)
    db.commit()
    return RedirectResponse(url="/servicios/", status_code=303)


@router.get("/{service_id}/editar", response_class=HTMLResponse)
async def edit_service_form(request: Request, service_id: int, db: Session = Depends(get_db)):
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")
    return templates.TemplateResponse("services/form.html", {
        "request": request,
        "service": service,
        "categories": ServiceCategory,
    })


@router.post("/{service_id}/editar")
async def update_service(
    request: Request,
    service_id: int,
    name: str = Form(...),
    description: str = Form(""),
    category: str = Form("otro"),
    price: float = Form(...),
    duration_days: int = Form(30),
    is_recurring: bool = Form(False),
    deliverables: str = Form(""),
    is_active: bool = Form(True),
    db: Session = Depends(get_db),
):
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")

    service.name = name
    service.description = description
    service.category = ServiceCategory(category)
    service.price = price
    service.duration_days = duration_days
    service.is_recurring = is_recurring
    service.deliverables = deliverables
    service.is_active = is_active
    db.commit()

    return RedirectResponse(url="/servicios/", status_code=303)


@router.post("/{service_id}/toggle")
async def toggle_service(service_id: int, db: Session = Depends(get_db)):
    service = db.query(Service).filter(Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Servicio no encontrado")
    service.is_active = not service.is_active
    db.commit()
    return RedirectResponse(url="/servicios/", status_code=303)

from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from app.database import Base


# ─── Enums ───────────────────────────────────────────────────────────────────

class ClientStatus(str, enum.Enum):
    activo = "activo"
    inactivo = "inactivo"
    prospecto = "prospecto"


class ServiceCategory(str, enum.Enum):
    inteligencia_competitiva = "Inteligencia Competitiva"
    investigacion_mercados = "Investigación de Mercados"
    due_diligence = "Due Diligence"
    monitoreo_marca = "Monitoreo de Marca"
    analisis_riesgos = "Análisis de Riesgos"
    informes_inteligencia = "Informes de Inteligencia"
    monitoreo_continuo = "Monitoreo Continuo"
    otro = "Otro"


class ContractStatus(str, enum.Enum):
    borrador = "borrador"
    activo = "activo"
    pausado = "pausado"
    completado = "completado"
    cancelado = "cancelado"


class PaymentStatus(str, enum.Enum):
    pendiente = "pendiente"
    pagado = "pagado"
    vencido = "vencido"
    cancelado = "cancelado"


class DeliveryStatus(str, enum.Enum):
    pendiente = "pendiente"
    en_progreso = "en_progreso"
    completado = "completado"
    entregado = "entregado"


class NotificationType(str, enum.Enum):
    pago_recibido = "pago_recibido"
    pago_vencido = "pago_vencido"
    recordatorio_pago = "recordatorio_pago"
    servicio_entregado = "servicio_entregado"
    contrato_vence = "contrato_vence"
    nuevo_cliente = "nuevo_cliente"
    nuevo_contrato = "nuevo_contrato"
    sistema = "sistema"


# ─── Models ──────────────────────────────────────────────────────────────────

class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String(200), nullable=False)
    contact_name = Column(String(200), nullable=False)
    email = Column(String(200), nullable=False, unique=True)
    phone = Column(String(50))
    address = Column(Text)
    industry = Column(String(100))
    status = Column(SAEnum(ClientStatus), default=ClientStatus.activo)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    contracts = relationship("Contract", back_populates="client", cascade="all, delete-orphan")

    @property
    def active_contracts(self):
        return [c for c in self.contracts if c.status == ContractStatus.activo]

    @property
    def total_revenue(self):
        return sum(p.amount for c in self.contracts for p in c.payments if p.status == PaymentStatus.pagado)


class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    category = Column(SAEnum(ServiceCategory), default=ServiceCategory.otro)
    price = Column(Float, nullable=False)
    duration_days = Column(Integer, default=30)
    is_recurring = Column(Boolean, default=False)
    deliverables = Column(Text)  # JSON string describing what's delivered
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    contracts = relationship("Contract", back_populates="service")


class Contract(Base):
    __tablename__ = "contracts"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False)
    title = Column(String(300))
    status = Column(SAEnum(ContractStatus), default=ContractStatus.borrador)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    total_amount = Column(Float, nullable=False)
    payment_schedule = Column(String(50), default="mensual")  # unico, mensual, trimestral
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    client = relationship("Client", back_populates="contracts")
    service = relationship("Service", back_populates="contracts")
    payments = relationship("Payment", back_populates="contract", cascade="all, delete-orphan")
    deliveries = relationship("ServiceDelivery", back_populates="contract", cascade="all, delete-orphan")

    @property
    def paid_amount(self):
        return sum(p.amount for p in self.payments if p.status == PaymentStatus.pagado)

    @property
    def pending_amount(self):
        return self.total_amount - self.paid_amount

    @property
    def days_remaining(self):
        delta = self.end_date - datetime.utcnow()
        return delta.days


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=False)
    amount = Column(Float, nullable=False)
    due_date = Column(DateTime, nullable=False)
    paid_date = Column(DateTime, nullable=True)
    status = Column(SAEnum(PaymentStatus), default=PaymentStatus.pendiente)
    payment_method = Column(String(100))
    reference = Column(String(200))
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    contract = relationship("Contract", back_populates="payments")

    @property
    def is_overdue(self):
        return self.status == PaymentStatus.pendiente and self.due_date < datetime.utcnow()


class ServiceDelivery(Base):
    __tablename__ = "service_deliveries"

    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey("contracts.id"), nullable=False)
    title = Column(String(300), nullable=False)
    description = Column(Text)
    status = Column(SAEnum(DeliveryStatus), default=DeliveryStatus.pendiente)
    due_date = Column(DateTime, nullable=False)
    completed_date = Column(DateTime, nullable=True)
    delivered_date = Column(DateTime, nullable=True)
    deliverable_url = Column(String(500))
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    contract = relationship("Contract", back_populates="deliveries")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(SAEnum(NotificationType))
    title = Column(String(300), nullable=False)
    message = Column(Text, nullable=False)
    recipient_email = Column(String(200))
    is_read = Column(Boolean, default=False)
    email_sent = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    related_id = Column(Integer)  # ID of related entity
    related_type = Column(String(50))  # 'contract', 'payment', etc.

import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
AGENCY_NAME = os.getenv("AGENCY_NAME", "Agencia de Inteligencia")
AGENCY_EMAIL = os.getenv("AGENCY_EMAIL", "")


def send_email(to: str, subject: str, html_body: str) -> bool:
    """Envía un correo electrónico. Retorna True si fue exitoso."""
    if not SMTP_USER or not SMTP_PASSWORD:
        print(f"[EMAIL SIMULADO] Para: {to} | Asunto: {subject}")
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{AGENCY_NAME} <{SMTP_USER}>"
        msg["To"] = to

        part = MIMEText(html_body, "html", "utf-8")
        msg.attach(part)

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, to, msg.as_string())

        return True
    except Exception as e:
        print(f"[ERROR EMAIL] {e}")
        return False


def email_payment_reminder(client_name: str, client_email: str, amount: float, due_date: str, contract_title: str) -> bool:
    subject = f"Recordatorio de pago - {contract_title}"
    body = f"""
    <html><body style="font-family: Arial, sans-serif; color: #333;">
    <div style="max-width:600px;margin:auto;padding:20px;border:1px solid #ddd;border-radius:8px;">
        <h2 style="color:#2c3e50;">Recordatorio de Pago</h2>
        <p>Estimado/a <strong>{client_name}</strong>,</p>
        <p>Le recordamos que tiene un pago pendiente:</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
            <tr style="background:#f8f9fa;">
                <td style="padding:10px;border:1px solid #dee2e6;"><strong>Contrato</strong></td>
                <td style="padding:10px;border:1px solid #dee2e6;">{contract_title}</td>
            </tr>
            <tr>
                <td style="padding:10px;border:1px solid #dee2e6;"><strong>Monto</strong></td>
                <td style="padding:10px;border:1px solid #dee2e6;font-size:1.2em;color:#27ae60;"><strong>${amount:,.2f}</strong></td>
            </tr>
            <tr style="background:#f8f9fa;">
                <td style="padding:10px;border:1px solid #dee2e6;"><strong>Fecha límite</strong></td>
                <td style="padding:10px;border:1px solid #dee2e6;">{due_date}</td>
            </tr>
        </table>
        <p>Por favor procese su pago antes de la fecha indicada para evitar interrupciones en el servicio.</p>
        <p>Si ya realizó el pago, por favor ignora este mensaje.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
        <p style="color:#666;font-size:0.9em;">{AGENCY_NAME}</p>
    </div>
    </body></html>
    """
    return send_email(client_email, subject, body)


def email_payment_overdue(client_name: str, client_email: str, amount: float, due_date: str, contract_title: str, days_overdue: int) -> bool:
    subject = f"URGENTE: Pago vencido - {contract_title}"
    body = f"""
    <html><body style="font-family: Arial, sans-serif; color: #333;">
    <div style="max-width:600px;margin:auto;padding:20px;border:2px solid #e74c3c;border-radius:8px;">
        <h2 style="color:#e74c3c;">Pago Vencido</h2>
        <p>Estimado/a <strong>{client_name}</strong>,</p>
        <p>Su pago está <strong style="color:#e74c3c;">{days_overdue} día(s) vencido</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
            <tr style="background:#fdecea;">
                <td style="padding:10px;border:1px solid #dee2e6;"><strong>Contrato</strong></td>
                <td style="padding:10px;border:1px solid #dee2e6;">{contract_title}</td>
            </tr>
            <tr>
                <td style="padding:10px;border:1px solid #dee2e6;"><strong>Monto</strong></td>
                <td style="padding:10px;border:1px solid #dee2e6;font-size:1.2em;color:#e74c3c;"><strong>${amount:,.2f}</strong></td>
            </tr>
            <tr style="background:#fdecea;">
                <td style="padding:10px;border:1px solid #dee2e6;"><strong>Venció el</strong></td>
                <td style="padding:10px;border:1px solid #dee2e6;">{due_date}</td>
            </tr>
        </table>
        <p>Por favor regularice su situación a la brevedad.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
        <p style="color:#666;font-size:0.9em;">{AGENCY_NAME}</p>
    </div>
    </body></html>
    """
    return send_email(client_email, subject, body)


def email_service_delivered(client_name: str, client_email: str, service_title: str, deliverable_url: str, contract_title: str) -> bool:
    subject = f"Servicio entregado: {service_title}"
    link = f'<p><a href="{deliverable_url}" style="background:#27ae60;color:#fff;padding:10px 20px;border-radius:5px;text-decoration:none;">Ver entregable</a></p>' if deliverable_url else ""
    body = f"""
    <html><body style="font-family: Arial, sans-serif; color: #333;">
    <div style="max-width:600px;margin:auto;padding:20px;border:1px solid #ddd;border-radius:8px;">
        <h2 style="color:#27ae60;">Servicio Entregado</h2>
        <p>Estimado/a <strong>{client_name}</strong>,</p>
        <p>Nos complace informarle que hemos completado la entrega del siguiente servicio:</p>
        <div style="background:#f8f9fa;padding:15px;border-radius:5px;margin:20px 0;">
            <p><strong>Contrato:</strong> {contract_title}</p>
            <p><strong>Entrega:</strong> {service_title}</p>
        </div>
        {link}
        <p>Si tiene alguna pregunta o comentario, no dude en contactarnos.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
        <p style="color:#666;font-size:0.9em;">{AGENCY_NAME}</p>
    </div>
    </body></html>
    """
    return send_email(client_email, subject, body)


def email_contract_expiring(client_name: str, client_email: str, contract_title: str, end_date: str, days_remaining: int) -> bool:
    subject = f"Su contrato vence en {days_remaining} días - {contract_title}"
    body = f"""
    <html><body style="font-family: Arial, sans-serif; color: #333;">
    <div style="max-width:600px;margin:auto;padding:20px;border:1px solid #f39c12;border-radius:8px;">
        <h2 style="color:#f39c12;">Contrato por Vencer</h2>
        <p>Estimado/a <strong>{client_name}</strong>,</p>
        <p>Le informamos que su contrato <strong>"{contract_title}"</strong> vencerá en <strong>{days_remaining} días</strong> ({end_date}).</p>
        <p>Si desea renovar o ampliar el contrato, contáctenos con anticipación.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
        <p style="color:#666;font-size:0.9em;">{AGENCY_NAME}</p>
    </div>
    </body></html>
    """
    return send_email(client_email, subject, body)

#!/usr/bin/env python3
"""
PsicoIA - Tu Psicólogo Personal con IA
Privacidad garantizada: toda la información permanece en esta sesión únicamente.
Ningún dato sale del chat ni se almacena en ningún sistema externo.
"""

import os
import sys
from anthropic import Anthropic

client = Anthropic()

SYSTEM_PROMPT_TEMPLATE = """\
Eres PsicoIA, un psicólogo virtual especializado, empático y completamente confidencial.
Tu misión es escuchar activamente, comprender en profundidad la situación emocional
y personal del usuario, y proporcionar recomendaciones psicológicas prácticas,
personalizadas y basadas en evidencia científica.

═══════════════════════════════════════════
PRINCIPIOS FUNDAMENTALES
═══════════════════════════════════════════
1. PRIVACIDAD ABSOLUTA: Toda la información compartida es estrictamente confidencial
   y NUNCA sale de esta conversación. No se almacena ni comparte con nadie.
2. EMPATÍA SIN JUICIOS: Valida siempre los sentimientos antes de aconsejar.
   Nunca juzgues decisiones, emociones ni comportamientos del usuario.
3. PERSONALIZACIÓN: Usa el perfil personal del usuario para adaptar cada respuesta
   a su realidad concreta y su contexto de vida.
4. LÍMITES DE SEGURIDAD: Si detectas riesgo de autolesión o crisis severa,
   recomienda SIEMPRE atención profesional presencial urgente.
   En España: línea de atención a conducta suicida 024 (gratuita, 24h).
5. HONESTIDAD PROFESIONAL: Si una situación supera el ámbito de un agente virtual,
   dílo con claridad y amabilidad, y sugiere recursos profesionales.

═══════════════════════════════════════════
PERFIL PERSONAL DEL USUARIO
═══════════════════════════════════════════
{user_profile}

═══════════════════════════════════════════
TÉCNICAS PSICOLÓGICAS DISPONIBLES
═══════════════════════════════════════════
- Terapia Cognitivo-Conductual (TCC): reestructuración de pensamientos automáticos negativos
- Mindfulness y técnicas de anclaje al presente (5 sentidos, respiración 4-7-8)
- Regulación emocional (DBT): tolerar el malestar sin reaccionar impulsivamente
- Comunicación asertiva y resolución de conflictos interpersonales
- Gestión del estrés: técnica STOP, descarga física, planificación
- Psicología positiva: gratitud, fortalezas, emociones positivas
- Autocompasión: hablarte como le hablarías a un amigo querido
- Activación conductual: acción antes que motivación
- Técnica del registro de pensamientos (diálogo socrático)

═══════════════════════════════════════════
ESTRUCTURA DE RESPUESTA
═══════════════════════════════════════════
Tus respuestas siguen siempre este flujo natural:
1. VALIDACIÓN EMOCIONAL: Reconoce y valida cómo se siente el usuario
2. COMPRENSIÓN: Demuestra que entiendes la situación usando sus propias palabras
3. PERSPECTIVA (opcional): Encuadre útil y breve, sin tecnicismos
4. RECOMENDACIONES (2-3 máximo): Prácticas, concretas, aplicables ahora mismo
5. CIERRE: Pregunta de seguimiento o mensaje de apoyo personalizado

Usa el nombre del usuario si lo conoces. Mantén un tono cálido, cercano y profesional.
Responde en el idioma que use el usuario. Nunca des listas largas ni respuestas frias.
"""


def print_header():
    print()
    print("╔" + "═" * 58 + "╗")
    print("║" + " " * 19 + "PSICOÍA" + " " * 32 + "║")
    print("║" + " " * 13 + "Tu Psicólogo Personal con IA" + " " * 17 + "║")
    print("╚" + "═" * 58 + "╝")
    print()
    print("  PRIVACIDAD GARANTIZADA")
    print("  - Tu información es completamente privada")
    print("  - Los datos NO salen de esta conversación")
    print("  - Nada se almacena ni comparte externamente")
    print()


def collect_user_profile() -> dict:
    """Collect personal profile interactively with privacy emphasis."""
    print("-" * 60)
    print("  CUÉNTAME SOBRE TI")
    print("-" * 60)
    print("  Para personalizar mejor mis recomendaciones me")
    print("  gustaría conocerte un poco. Puedes responder N/A")
    print("  si prefieres no compartir algo.")
    print()

    profile = {}

    fields = [
        ("nombre",        "¿Cómo te llamas o cómo quieres que te llame?"),
        ("edad",          "¿Cuántos años tienes?"),
        ("situacion",     "¿Cuál es tu situación actual?\n  (ej: estudiante, trabajador/a, con pareja, con hijos...)"),
        ("caracter",      "¿Cómo describirías tu carácter?\n  (ej: ansioso/a, perfeccionista, empático/a, introvertido/a...)"),
        ("estado_actual", "En general, ¿cómo te has sentido estas últimas semanas?"),
        ("areas_mejora",  "¿Hay algo específico en lo que quieras trabajar?\n  (ej: ansiedad, relaciones, autoestima, estrés laboral...)"),
    ]

    for key, question in fields:
        print(f"  {question}")
        answer = input("  → ").strip()
        print()
        if answer and answer.upper() not in ("N/A", "NA", ""):
            profile[key] = answer

    return profile


def format_profile(profile: dict) -> str:
    """Convert profile dict to readable text for the system prompt."""
    if not profile:
        return "El usuario no ha proporcionado datos personales. Trátalo con respeto, calidez y empatía universal."

    labels = {
        "nombre":        "Nombre",
        "edad":          "Edad",
        "situacion":     "Situación vital",
        "caracter":      "Personalidad / Carácter",
        "estado_actual": "Estado emocional reciente",
        "areas_mejora":  "Áreas de trabajo y mejora",
    }

    lines = []
    for key, value in profile.items():
        label = labels.get(key, key.replace("_", " ").title())
        lines.append(f"- {label}: {value}")
    return "\n".join(lines)


def run():
    """Main conversation loop."""
    print_header()

    # --- Collect user profile ---
    profile = collect_user_profile()
    profile_text = format_profile(profile)
    user_name = profile.get("nombre", "")
    name_suffix = f", {user_name}" if user_name else ""

    # --- Build system prompt (cached) ---
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(user_profile=profile_text)

    # --- In-memory conversation history ---
    history = []

    print("-" * 60)
    print("  SESIÓN INICIADA")
    print("-" * 60)
    print()
    print("  Comandos:  'salir' → terminar | 'perfil' → ver tus datos")
    print()

    # Generate initial greeting
    seed = {"role": "user", "content": f"Hola, acabo de comenzar la sesión{name_suffix}."}
    try:
        resp = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=600,
            system=[
                {
                    "type": "text",
                    "text": system_prompt,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[seed],
        )
        greeting = resp.content[0].text
        history.append(seed)
        history.append({"role": "assistant", "content": greeting})
        print(f"PsicoIA: {greeting}\n")
    except Exception as exc:
        print(f"  [Error al iniciar la sesión: {exc}]")
        print("  Comprueba que ANTHROPIC_API_KEY está configurada correctamente.\n")
        return

    # --- Main loop ---
    while True:
        try:
            user_input = input("Tú: ").strip()
        except (EOFError, KeyboardInterrupt):
            print(f"\nPsicoIA: Ha sido un placer acompañarte{name_suffix}. ¡Cuídate mucho!\n")
            break

        if not user_input:
            continue

        if user_input.lower() == "salir":
            print(
                f"\nPsicoIA: Ha sido un placer estar aquí contigo{name_suffix}. "
                f"Cuidar tu salud mental es una de las mejores cosas que puedes "
                f"hacer por ti. ¡Hasta pronto!\n"
            )
            break

        if user_input.lower() == "perfil":
            print("\n─── TU PERFIL (solo visible en esta sesión) ───")
            print(profile_text)
            print("───────────────────────────────────────────────\n")
            continue

        history.append({"role": "user", "content": user_input})

        try:
            resp = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=2048,
                system=[
                    {
                        "type": "text",
                        "text": system_prompt,
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
                messages=history,
            )
            reply = resp.content[0].text
            history.append({"role": "assistant", "content": reply})
            print(f"\nPsicoIA: {reply}\n")
        except Exception as exc:
            print(f"\n  [Error de conexión: {exc}. Inténtalo de nuevo.]\n")
            history.pop()


if __name__ == "__main__":
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("\n  ERROR: Falta la variable de entorno ANTHROPIC_API_KEY.")
        print("  Configúrala así:")
        print("    export ANTHROPIC_API_KEY='tu-api-key'\n")
        sys.exit(1)
    run()

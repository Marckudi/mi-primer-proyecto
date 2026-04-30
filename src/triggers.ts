export interface Trigger {
  keyword: string;       // palabra clave (case-insensitive, exact word match)
  publicReply: string;   // respuesta pública visible en el comentario
  dmText: string;        // mensaje completo enviado por DM
  sourceUrl?: string;    // URL opcional para extraer contenido actualizado
}

export const TRIGGERS: Trigger[] = [

  // ─── CONCEPTOS DE LA PLATAFORMA ───────────────────────────────────────────

  {
    keyword: "MRA",
    publicReply: "¡Hola! Te acabo de enviar toda la información sobre el Score MRA por DM 📩 ¡Révisalo!",
    dmText:
      `🎯 SCORE MRA — Guía Completa\n\n` +
      `El Score MRA es el sistema de puntuación de AlphaVision AI que evalúa la calidad de cada setup de trading del 0 al 10.\n\n` +
      `📊 Escala de puntuación:\n` +
      `• Score 0–6 → Setup débil. NO se opera.\n` +
      `• Score 7–8 → Setup válido. Entrada con gestión estricta.\n` +
      `• Score 9–10 → Setup óptimo. Máxima confianza.\n\n` +
      `⏰ La Ventana MRA\n` +
      `Solo se opera entre las 07:55 y las 10:40 CET. Fuera de esa franja el sistema no emite señales.\n\n` +
      `💱 Pares operados: EUR/USD · GBP/USD · XAU/USD\n\n` +
      `Sigue la cuenta para ver los setups en tiempo real 🚀`,
  },

  {
    keyword: "AURA",
    publicReply: "¡Perfecto! Te he enviado toda la info sobre AURA por DM 📩",
    dmText:
      `🔊 AURA — Asistente de Voz de AlphaVision AI\n\n` +
      `AURA es el sistema de alertas de voz en tiempo real de AlphaVision AI.\n\n` +
      `¿Qué hace AURA?\n` +
      `Cuando el Score MRA alcanza ≥ 7 dentro de la Ventana MRA (07:55–10:40 CET), AURA emite una alerta de voz instantánea avisando del setup válido.\n\n` +
      `🔔 ¿Por qué es útil?\n` +
      `• No necesitas estar mirando la pantalla constantemente\n` +
      `• La alerta llega justo cuando el mercado presenta las condiciones ideales\n` +
      `• Elimina el ruido emocional: operas solo cuando el sistema lo valida\n\n` +
      `AURA forma parte de la plataforma completa de AlphaVision AI. Sigue la cuenta para más info 👀`,
  },

  {
    keyword: "VENTANA",
    publicReply: "¡Te envío la explicación completa de la Ventana MRA por DM ahora mismo 📩!",
    dmText:
      `⏰ LA VENTANA MRA — Cuándo operar\n\n` +
      `La Ventana MRA es el único periodo del día en el que AlphaVision AI considera válido operar: de 07:55 a 10:40 CET.\n\n` +
      `¿Por qué solo ese horario?\n` +
      `• Coincide con la apertura del mercado europeo y el solapamiento con Londres\n` +
      `• Es cuando mayor volumen y liquidez hay en EUR/USD, GBP/USD y XAU/USD\n` +
      `• Fuera de esa franja, el sistema no emite ninguna señal aunque el Score sea alto\n\n` +
      `🔴 Fuera de ventana = sin operación, sin importar el Score.\n` +
      `🟢 Dentro de ventana + Score ≥ 7 = setup válido.\n\n` +
      `Sigue la cuenta para los setups diarios 🚀`,
  },

  // ─── SOLICITUDES DE INFORMACIÓN GENERAL ────────────────────────────────────

  {
    keyword: "INFO",
    publicReply: "¡Claro! Te mando toda la información de AlphaVision AI por DM 📩",
    dmText:
      `💡 AlphaVision AI — Resumen Completo\n\n` +
      `AlphaVision AI es una plataforma de trading automatizado que opera en el mercado forex e identifica setups de alta probabilidad mediante su sistema propio: el Score MRA.\n\n` +
      `🔑 Conceptos clave:\n` +
      `• Score MRA: puntuación 0–10 de calidad del setup\n` +
      `• Ventana MRA: 07:55–10:40 CET — única franja operativa\n` +
      `• AURA: alerta de voz cuando hay setup válido\n` +
      `• Pares: EUR/USD, GBP/USD, XAU/USD\n\n` +
      `📊 Regla de entrada:\n` +
      `Score ≥ 7 dentro de la Ventana MRA = entrada válida.\n\n` +
      `Sigue la cuenta y activa las notificaciones para no perderte ningún setup 🚀`,
  },

  {
    keyword: "COMO",
    publicReply: "¡Te explico cómo funciona todo por DM ahora mismo 📩!",
    dmText:
      `📖 Cómo funciona AlphaVision AI — Paso a paso\n\n` +
      `1️⃣ Cada día hábil, antes de las 07:55 CET, el sistema calcula el Score MRA del día.\n\n` +
      `2️⃣ Si el Score es ≥ 7, AURA emite una alerta de voz y el setup queda activo.\n\n` +
      `3️⃣ Durante la Ventana MRA (07:55–10:40 CET) se ejecuta la operación en el par correspondiente.\n\n` +
      `4️⃣ Si el Score es < 7, no se opera ese día. La disciplina es parte del sistema.\n\n` +
      `⚠️ Sin promesas de ganancias garantizadas. Trading = riesgo. Opera solo con capital que puedas permitirte perder.\n\n` +
      `Sigue la cuenta para ver los resultados reales, día a día 📊`,
  },

  {
    keyword: "CÓMO",
    publicReply: "¡Te explico cómo funciona todo por DM ahora mismo 📩!",
    dmText:
      `📖 Cómo funciona AlphaVision AI — Paso a paso\n\n` +
      `1️⃣ Cada día hábil, antes de las 07:55 CET, el sistema calcula el Score MRA del día.\n\n` +
      `2️⃣ Si el Score es ≥ 7, AURA emite una alerta de voz y el setup queda activo.\n\n` +
      `3️⃣ Durante la Ventana MRA (07:55–10:40 CET) se ejecuta la operación en el par correspondiente.\n\n` +
      `4️⃣ Si el Score es < 7, no se opera ese día. La disciplina es parte del sistema.\n\n` +
      `⚠️ Sin promesas de ganancias garantizadas. Trading = riesgo. Opera solo con capital que puedas permitirte perder.\n\n` +
      `Sigue la cuenta para ver los resultados reales, día a día 📊`,
  },

  // ─── SOLICITUDES DE ACCESO / PRECIO ─────────────────────────────────────────

  {
    keyword: "PRECIO",
    publicReply: "¡Te envío la información sobre acceso por DM 📩!",
    dmText:
      `💰 Acceso a AlphaVision AI\n\n` +
      `Gracias por tu interés. Para información sobre planes de acceso y precios actualizados, respóndeme aquí en DM y te damos todos los detalles.\n\n` +
      `Mientras tanto, sigue la cuenta para ver los setups y resultados en tiempo real 📊`,
  },

  {
    keyword: "ACCESO",
    publicReply: "¡Te envío la información sobre acceso por DM 📩!",
    dmText:
      `🔑 Acceso a AlphaVision AI\n\n` +
      `Gracias por tu interés en la plataforma. Para ver opciones de acceso disponibles respóndeme aquí en DM y te informamos de todo.\n\n` +
      `Sigue la cuenta para no perderte ningún setup 🚀`,
  },

  {
    keyword: "GRATIS",
    publicReply: "¡Te mando info sobre el acceso de prueba por DM 📩!",
    dmText:
      `🎁 Prueba de AlphaVision AI\n\n` +
      `Respóndeme aquí por DM y te contamos qué opciones de acceso tenemos disponibles.\n\n` +
      `Mientras tanto en la cuenta publicamos setups reales cada día — úsalos como referencia 📊`,
  },

  // ─── SEÑALES / RESULTADOS ────────────────────────────────────────────────────

  {
    keyword: "SEÑAL",
    publicReply: "¡Te explico cómo funcionan las señales MRA por DM 📩!",
    dmText:
      `📶 Señales de AlphaVision AI\n\n` +
      `Las señales no son alertas aleatorias. Son setups validados por el Score MRA.\n\n` +
      `¿Cuándo se emite una señal?\n` +
      `• Score MRA ≥ 7 (setup de calidad)\n` +
      `• Dentro de la Ventana MRA (07:55–10:40 CET)\n` +
      `• En uno de los tres pares: EUR/USD, GBP/USD o XAU/USD\n\n` +
      `AURA emite la alerta de voz en tiempo real cuando se cumplen las condiciones.\n\n` +
      `⚠️ Toda operación implica riesgo. Los resultados pasados no garantizan resultados futuros.\n\n` +
      `Sigue la cuenta para ver los setups diarios 🚀`,
  },

  {
    keyword: "RESULTADOS",
    publicReply: "¡Te mando el historial de resultados reales por DM 📩!",
    dmText:
      `📊 Resultados de AlphaVision AI\n\n` +
      `En la cuenta publicamos los resultados reales de cada sesión MRA: ganancias y pérdidas, sin filtrar.\n\n` +
      `Transparencia total: mostramos tanto los setups que funcionan como los que no. El objetivo es construir confianza con datos reales.\n\n` +
      `Revisa el feed y los highlights de la cuenta para ver el historial completo.\n\n` +
      `⚠️ Resultados pasados no garantizan resultados futuros. Trading = riesgo.`,
  },

  {
    keyword: "SETUP",
    publicReply: "¡Te explico qué es un setup MRA por DM 📩!",
    dmText:
      `🔍 ¿Qué es un Setup MRA?\n\n` +
      `Un setup MRA es una oportunidad de trading identificada por el algoritmo de AlphaVision AI cuando se dan las condiciones óptimas en el mercado.\n\n` +
      `Condiciones para que sea válido:\n` +
      `• Score MRA ≥ 7/10\n` +
      `• Dentro de la Ventana MRA (07:55–10:40 CET)\n` +
      `• En EUR/USD, GBP/USD o XAU/USD\n\n` +
      `Cuando se cumplen las tres condiciones, AURA lanza la alerta y se ejecuta la operación.\n\n` +
      `Sigue la cuenta para ver los setups en tiempo real 📊`,
  },

];

export interface Trigger {
  keyword: string;       // palabra clave que activa la respuesta (case-insensitive)
  publicReply: string;   // respuesta pública en el comentario
  dmText: string;        // texto completo que se envía por DM
  sourceUrl?: string;    // URL opcional para extraer contenido actualizado
}

export const TRIGGERS: Trigger[] = [
  {
    keyword: "MRA",
    publicReply:
      "¡Hola! Te acabo de enviar toda la información sobre el Score MRA por DM 📩 ¡Révisalo cuando puedas!",
    dmText:
      `🎯 SCORE MRA — Guía Completa de AlphaVision AI\n\n` +
      `El Score MRA es el sistema de puntuación que evalua la calidad de cada setup de trading del 0 al 10.\n\n` +
      `📊 ¿Cómo funciona?\n` +
      `• Score 0–6: Setup débil → NO se opera\n` +
      `• Score 7–8: Setup válido → entrada con gestión estricta\n` +
      `• Score 9–10: Setup óptimo → máxima confianza\n\n` +
      `⏰ La Ventana MRA\n` +
      `El único momento del día para operar es entre las 07:55 y las 10:40 CET.\n` +
      `Fuera de esta ventana el sistema no emite señales.\n\n` +
      `🔊 AURA\n` +
      `AURA es el asistente de voz de AlphaVision AI. Cuando detecta un setup con Score ≥ 7 dentro de la Ventana MRA emite una alerta en tiempo real.\n\n` +
      `💱 Pares operados\n` +
      `EUR/USD · GBP/USD · XAU/USD (Oro)\n\n` +
      `Sigue nuestra cuenta para no perderte ningún setup 🚀`,
  },
  // — Añade más triggers aquí para futuros reels —
  // {
  //   keyword: "AURA",
  //   publicReply: "¡Te enviamos info sobre AURA por DM! 📩",
  //   dmText: "...",
  // },
];

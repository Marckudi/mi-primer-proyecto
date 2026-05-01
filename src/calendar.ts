import type { ContentType } from "./types.js";

// Posts: 10:00 y 18:00 UTC (L-V), 12:00 sáb, 18:00 dom
// Reels: 14:00 UTC lunes/miércoles/viernes
export const CONTENT_CALENDAR: Record<string, Record<string, ContentType>> = {
  lunes:     { "10:00": "setup_del_dia",  "14:00": "reel_viral",   "18:00": "analisis" },
  martes:    { "10:00": "reel_setup",                               "18:00": "chart_analysis" },
  miercoles: { "10:00": "setup_mra",      "14:00": "reel_setup",   "18:00": "educacion" },
  jueves:    { "10:00": "reel_setup",                               "18:00": "carrusel_educativo" },
  viernes:   { "10:00": "setup_del_dia",  "14:00": "reel_marca",   "18:00": "recap_semanal" },
  sabado:    { "12:00": "carrusel_top3" },
  domingo:   { "18:00": "reel_preview" },
};

const DAY_NAMES: Record<number, string> = {
  0: "domingo", 1: "lunes",    2: "martes", 3: "miercoles",
  4: "jueves",  5: "viernes",  6: "sabado",
};

export function getTodaySchedule(date: Date): Record<string, ContentType> {
  return CONTENT_CALENDAR[DAY_NAMES[date.getDay()]] ?? {};
}

export function getDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

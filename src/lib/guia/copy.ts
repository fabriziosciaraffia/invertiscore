// ─────────────────────────────────────────────────────────────────────────────
// «Por dónde seguir buscando» (FASE 2 de los avisos evaluados, 30-sep-2026): el copy, fijado por
// Fabrizio. Los parecidos son una GUÍA de búsqueda —avisos publicados, revisados con los números de
// la persona—, no el portafolio de Franco: para describirlos nunca «portafolio», «exclusivo» ni
// «oportunidad» (VEDADAS_GUIA). El tier GUIA-BUSQUEDA fija cada frase y barre las vedadas.
// ─────────────────────────────────────────────────────────────────────────────

/** Palabras que no describen a los parecidos: quedan para el portafolio, que es otra cosa. */
export const VEDADAS_GUIA = ["portafolio", "exclusivo", "oportunidad"] as const;

/** La línea del ticket del pack. Sale SOLO donde la guía existe (`GUIA_ACTIVA` + renta larga). */
export const TICKET_INCLUYE_GUIA =
  "Incluye una selección de deptos publicados parecidos a este, ya revisados con tu pie y tu plazo. Analizas el que quieras con un clic.";

export const GUIA = {
  titulo: "Por dónde seguir buscando",
  bajada: "Deptos publicados hoy, parecidos y cercanos al que analizaste.",
  cuerpo: "Franco los revisó con tu pie y tu plazo, y estos son los mejores.",
  ajustada: "Ajustamos tu pie y tu plazo porque ninguno calzaba con esa combinación; estos son los mejores.",
  ninguno: "Ninguno conviene, ni con más plazo ni con más pie. Mejor sigue buscando en otra zona.",
  analizar: "Analizar este",
  analizando: "Generando…",
  usaUno: "Usa 1 de tus análisis",
  sinCreditos: "Ya usaste tus análisis.",
  error: "No pudimos generar el informe. Intenta de nuevo.",
  flujo: "Flujo mensual",
  veredicto: "Veredicto",
  teQueda: "te queda",
  saleDeTuBolsillo: "sale de tu bolsillo",
  chipComo: "Como el tuyo:",
  chipRadio: "A menos de",
  chipCombinacion: "Con pie",
  antiguedad: "Calculado con una antigüedad prudente de 25 años; el informe usa la real si el aviso la tiene.",
  pie: "Vistos en los últimos 7 días. Los precios son los publicados; el arriendo es el que Franco estima para cada uno en su zona.",
} as const;

/** El informe que sale de un aviso publicado. */
export const INFORME_DE_AVISO = {
  origen: "Este análisis sale de un aviso publicado.",
  antiguedadSupuesta: "El aviso no dice la antigüedad; Franco supuso 25 años, lo más prudente.",
  boton: "Quiero verlo",
  bajada: "Franco te hace llegar el aviso",
  listo: "Listo. Franco te hará llegar el depto para que lo evalúes directamente.",
  listoBajada: "A tu correo, hoy o mañana hábil.",
  error: "No pudimos registrarlo. Intenta de nuevo.",
} as const;

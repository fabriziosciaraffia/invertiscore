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

// 02-oct-2026 (decisión de Fabrizio): debajo de la línea de la selección, la urgencia. Esta es la versión
// GENÉRICA: sin cifras ni comunas. El 15-oct-2026 la medición de escasez la reemplaza por la versión con
// datos solo donde la muestra alcance; donde no, queda esta. El tier GUIA-BUSQUEDA fija que no lleve números.
export const TICKET_URGENCIA_GENERICA = "Los deptos que convienen se van rápido. Revísalos hoy.";

// 01-oct-2026: después de pagar, una sola idea —«compraste 3 análisis; empieza por estos»—. El título
// y el cuerpo se funden; «ajustada» y «ninguno» van debajo del título en lugar del cuerpo.
// 02-oct-2026: el título y «usa 1 de tus N» dicen el SALDO REAL (GUIA_SALDO, abajo), no «3» fijo: quien
// ya usó uno, o tenía saldo de antes, leía un número falso.
export const GUIA = {
  cuerpo: "Deptos publicados hoy, parecidos y cercanos al que analizaste. Franco los revisó con tu pie y tu plazo: estos son los mejores.",
  ajustada: "Ajustamos tu pie y tu plazo porque ninguno calzaba con esa combinación; estos son los mejores.",
  ninguno: "Ninguno conviene, ni con más plazo ni con más pie. Mejor sigue buscando en otra zona.",
  analizar: "Analizar este",
  analizando: "Generando…",
  otroDepto: "¿Tienes otro depto en mente?",
  otroDeptoEnlace: "Analízalo con tus números ya cargados",
  registroTitulo: "Entra con el correo con que pagaste y lo analizamos.",
  registroEnviado: (correo: string) => `Te mandamos un código a ${correo}.`,
  entrarYAnalizar: "Entrar y analizar",
  otraCuenta: "Esa cuenta no es la del pago. Entra con el correo con que pagaste.",
  sinCreditos: "Ya usaste tus análisis.",
  error: "No pudimos generar el informe. Intenta de nuevo.",
  // 01-oct-2026: el aviso se despublicó entre la guía y el clic. No se descuenta nada y la guía lo reemplaza.
  despublicado: "Este aviso ya no está publicado.",
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

/** Con el saldo real de la cuenta (`null` = no se pudo leer: la frase no inventa un número). En cero, lo
 *  dice: la guía sigue, pero no promete análisis que no hay. */
export const GUIA_SALDO = {
  titulo: (n: number | null): string =>
    n == null ? "Tus análisis ya están en tu cuenta. Empieza por estos." : n <= 0 ? "Ya usaste tus análisis. Estos son los que mejor calzan contigo." : `Tienes ${n} análisis. Empieza por estos.`,
  /** Junto a «Analizar este». `null` en cero: no hay de dónde usar uno. */
  usaUno: (n: number | null): string | null => (n == null ? "usa 1 de tus análisis" : n <= 0 ? null : n === 1 ? "usa el último que te queda" : `usa 1 de tus ${n}`),
} as const;

/** El informe que sale de un aviso publicado. */
export const INFORME_DE_AVISO = {
  origen: "Este análisis sale de un aviso publicado.",
  antiguedadSupuesta: "El aviso no dice la antigüedad; Franco supuso 25 años, lo más prudente.",
  boton: "Quiero verlo",
  bajada: "Franco te hace llegar el aviso",
  // 01-oct-2026: «Quiero verlo» es automático; el aviso llega al instante (sale «hoy o mañana hábil»).
  listo: "Listo. Te mandamos el aviso a tu correo.",
  despublicado: "Este aviso ya no está publicado.",
  error: "No pudimos registrarlo. Intenta de nuevo.",
} as const;
